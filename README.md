# Samudaya

**समुदाय** — a platform for running a residential community: notices, service
requests, visitors, amenities and maintenance dues, for the committee, the gate
and every resident.

One codebase, four surfaces:

| Surface       | What it is                                                        |
| ------------- | ----------------------------------------------------------------- |
| **Web**       | Next.js 16 app — resident portal, gate desk, and admin console    |
| **Mobile**    | Expo / React Native — iOS and Android from the same source        |
| **WhatsApp**  | A bot residents message to report issues and check dues           |
| **API & MCP** | REST for integrations, MCP so an AI assistant can use it as tools |

Nobody joins by guessing a URL. An admin mints an **invite code**; a resident
signs in with Google and enters it once. The code decides their role and,
optionally, the flat they are attached to.

---

## How it is put together

```
apps/
  web/        Next.js 16 (App Router) — UI, REST API, MCP server, WhatsApp webhook
  mobile/     Expo SDK 57 + expo-router — iOS, Android
packages/
  core/       Domain rules: roles, zod schemas, invite codes, WhatsApp parsing
  supabase/   Typed Supabase clients + generated database types
  config/     Shared TypeScript config
supabase/
  migrations/ Schema, RLS policies and RPCs
  tests/      A Supabase shim + the RLS test suite
scripts/      db-test.sh, smoke-test.sh, gen-db-types.mjs, seed.ts
```

### Where the rules actually live

**In PostgreSQL.** Every table has row-level security; the web app, the mobile
app, the API and the bot all go through it. The TypeScript in
`packages/core/src/roles.ts` decides what to _show_ a user — it is not what
stops them. That separation is deliberate and tested: `supabase/tests` asserts
that a resident cannot promote themselves, that a member of one community sees
nothing of another's, that a gate guard cannot read maintenance tickets, and
that the last owner cannot be removed.

Two places bypass RLS on purpose, both server-side only:

- **API-key requests** — there is no Supabase user behind an AI agent's key, so
  the service role is used and every query is scoped by hand. All of those
  queries live in one file, `apps/web/src/lib/api/resources.ts`, so the scoping
  cannot be forgotten piecemeal.
- **The WhatsApp webhook** — a phone number is not a session. `lib/whatsapp/bot.ts`
  resolves the sender to one community first and scopes everything to it.

---

## Getting it running

### 1. Create a Supabase project

Anywhere you like — [supabase.com](https://supabase.com) or a local stack.
You need the project URL, the anon key and the service-role key.

### 2. Apply the schema

```bash
pnpm dlx supabase link --project-ref <your-ref>
pnpm db:push          # applies supabase/migrations in order
```

### 3. Turn on Google sign-in

In the Supabase dashboard → **Authentication → Providers → Google**, add your
Google OAuth client ID and secret. In the Google Cloud console, add this
redirect URI:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

Then under **Authentication → URL Configuration**, add your site URL and
`http://localhost:3000/**` to the redirect allow-list. Email magic links work
with no extra setup, as a fallback for residents without a Google account.

### 4. Configure and run

```bash
cp .env.example apps/web/.env.local     # fill in the Supabase values
cp .env.example apps/mobile/.env        # the EXPO_PUBLIC_ ones
pnpm install
pnpm dev
```

The web app is on `http://localhost:3000`; `pnpm --filter @samudaya/mobile start`
opens the Expo dev server.

### 5. First run

1. Sign in, then choose **Create a community** — you become its owner.
2. **Admin → Units**: paste your flat list (`A,101` one per line).
3. **Admin → Invite codes**: create a code and send it to a resident.

---

## WhatsApp

Uses the [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api).
Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`
and `WHATSAPP_VERIFY_TOKEN`, then point the webhook at:

```
https://<your-host>/api/webhooks/whatsapp
```

All four variables are required — with any of them missing the webhook returns
503 rather than accepting requests it cannot verify. Every delivery's
`X-Hub-Signature-256` is checked against the raw body before anything is read,
and `whatsapp_messages.wa_message_id` is unique so Meta's retries cannot
double-process a message.

A resident links their number from **Settings → WhatsApp**: the app shows a
code, they send `link ABC123` to the bot. After that:

```
notices          latest announcements
report <text>    raise a service request
status           your open requests
visitor <name>   create a gate pass, returns the gate code
dues             outstanding bills
amenities        what is bookable
stop             opt out
```

---

## Letting an AI assistant use it

Samudaya speaks the **Model Context Protocol**. Create a key under
**Admin → API & AI access**, pick its scopes, then:

```json
{
  "mcpServers": {
    "samudaya": {
      "type": "http",
      "url": "https://<your-host>/api/mcp",
      "headers": { "Authorization": "Bearer sam_live_…" }
    }
  }
}
```

`tools/list` is filtered by the key's scopes, so a read-only key never sees
`post_announcement` at all. The full key is shown once and never stored — only
a SHA-256 digest is kept, in a table with RLS enabled and no policies, which no
client role can read.

The same keys work against the REST API:

```bash
curl https://<your-host>/api/v1/requests?status=open \
  -H "Authorization: Bearer sam_live_…"
```

See [`docs/api.md`](docs/api.md) for the endpoints and scopes.

---

## Mobile builds

```bash
cd apps/mobile
pnpm dlx eas-cli build --platform ios      # or android
```

Set `extra.eas.projectId` in `app.json` to your own EAS project first. The
bundle identifier and package name are `com.samudaya.app`; change them to
something you own before submitting to either store.

---

## Checks

```bash
pnpm db:test      # applies every migration to a throwaway Postgres, runs the RLS suite
pnpm test         # unit tests across the workspace
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke        # boots the built app and probes the public surface
```

`db:test` needs a local PostgreSQL 16 (`postgresql-16` + `postgresql-contrib-16`)
but no Docker: `supabase/tests/00_harness.sql` stands in for the parts of
Supabase the migrations depend on.

After a schema change, regenerate the types:

```bash
pnpm db:test                                   # rebuilds the test database
node scripts/gen-db-types.mjs "postgresql://postgres@127.0.0.1:55432/samudaya_test"
```

---

## What is deliberately not done yet

- **Payments** are recorded, not collected. There is no gateway integration —
  `payments.gateway_payload` is there for when you add one.
- **Push notifications** register a device token but nothing sends to it yet;
  the sending side wants a scheduled job or an edge function.
- **File attachments** on requests and notices have a `jsonb` column reserved
  but no Supabase Storage bucket wired up.
- **Polls and documents** are in neither the schema nor the UI.
