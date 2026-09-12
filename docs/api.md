# API reference

Two doors into the same data, both at `https://<your-host>`:

- **`/api/v1/*`** — a plain REST surface
- **`/api/mcp`** — the same operations as MCP tools, for AI assistants

Both accept either an **API key** or a **user token**, and neither is a way
around row-level security for a signed-in user.

---

## Authentication

### API keys

Created under **Admin → API & AI access**. Send as a bearer token:

```
Authorization: Bearer sam_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A key is bound to one community and cannot reach another, whatever it asks for.
Its **scopes** decide what it can do. A `:write` scope implies the matching
`:read`, so granting `requests:write` alone is enough to both read and file
tickets.

| Scope                 | Grants                                        |
| --------------------- | --------------------------------------------- |
| `announcements:read`  | Read notices                                  |
| `announcements:write` | Post notices — residents see them immediately |
| `requests:read`       | Read service requests                         |
| `requests:write`      | Raise, update and comment on service requests |
| `visitors:read`       | Read visitor passes, including gate codes     |
| `visitors:write`      | Create visitor passes                         |
| `amenities:read`      | Read amenities and bookings                   |
| `amenities:write`     | Book amenities                                |
| `members:read`        | Read the member list                          |
| `billing:read`        | Read invoices and balances                    |

The plaintext key is shown once at creation and never stored. What is kept is a
SHA-256 digest in `public.api_key_secrets` — a table with RLS enabled and no
policies at all, so no client role can read a row, and comparison happens inside
the database in constant time.

Revoking a key takes effect on the next request.

### User tokens

A Supabase access token works too — this is what the mobile app sends:

```
Authorization: Bearer <supabase-access-token>
```

Requests authenticated this way run **as that user**, so RLS applies exactly as
it does in the web app and scopes are not consulted. If the user belongs to more
than one community, add `?community=<slug>`; without it the request is refused
rather than guessing which society you meant.

---

## Response shape

Success:

```json
{ "data": … }
```

Failure:

```json
{ "error": { "code": "forbidden", "message": "This key is missing the “requests:write” scope." } }
```

| `code`            | HTTP | Meaning                                                        |
| ----------------- | ---- | -------------------------------------------------------------- |
| `unauthorized`    | 401  | No credentials, or they are not valid                          |
| `forbidden`       | 403  | Authenticated, but not allowed — missing scope, or RLS said no |
| `not_found`       | 404  | No such record _in this community_                             |
| `conflict`        | 409  | Already exists, or the amenity slot was just taken             |
| `invalid_request` | 422  | Validation failed; `details` carries the field errors          |
| `rate_limited`    | 429  | Too many attempts                                              |
| `server_error`    | 500  | Something broke on our side                                    |

A 404 and "exists but you may not see it" are deliberately indistinguishable.

---

## Endpoints

### `GET /api/v1/me`

_Scope: `members:read`_ — the community this credential belongs to, plus the
caller's role and scopes. Worth calling first.

### `GET /api/v1/announcements`

_Scope: `announcements:read`_ — currently visible notices, pinned first.
Query: `limit` (default 25, max 100).

### `POST /api/v1/announcements`

_Scope: `announcements:write`_

```json
{
  "title": "Water supply interruption",
  "body": "Off from 10am to 2pm on Saturday while the tanks are cleaned.",
  "audience": "all",
  "is_pinned": false,
  "expires_at": "2026-10-01T12:00:00Z"
}
```

`audience` is one of `all`, `residents`, `owners`, `committee`, `staff`.

### `GET /api/v1/requests`

_Scope: `requests:read`_ — query: `status` (comma-separated, e.g.
`open,in_progress`), `limit`.

### `POST /api/v1/requests`

_Scope: `requests:write`_

```json
{
  "title": "Leaking tap in kitchen",
  "description": "Dripping since Monday.",
  "category": "plumbing",
  "priority": "normal"
}
```

`category`: `plumbing`, `electrical`, `housekeeping`, `security`, `common_area`,
`parking`, `billing`, `other`. `priority`: `low`, `normal`, `high`, `urgent`.

### `GET /api/v1/requests/{id}` · `PATCH /api/v1/requests/{id}`

_Scopes: `requests:read` / `requests:write`_ — PATCH accepts `status`,
`priority`, `assigned_to`.

### `POST /api/v1/requests/{id}/comments`

_Scope: `requests:write`_

```json
{ "body": "Plumber booked for Thursday.", "is_internal": false }
```

An internal note is visible to staff only. Residents cannot set it — the
database rejects the attempt.

### `GET /api/v1/visitors` · `POST /api/v1/visitors`

_Scopes: `visitors:read` / `visitors:write`_

```json
{
  "visitor_name": "Ravi Kumar",
  "kind": "guest",
  "expected_at": "2026-09-20T14:00:00Z",
  "valid_until": "2026-09-20T22:00:00Z",
  "party_size": 2
}
```

The response carries `pass_code` — the six digits the guest reads out at the
gate.

### `GET /api/v1/amenities`

_Scope: `amenities:read`_ — bookable facilities plus the slots already taken.

### `GET /api/v1/members`

_Scope: `members:read`_ — active members and their roles.

### `GET /api/v1/invoices`

_Scope: `billing:read`_ — invoices with `balance_due`.

### `GET /api/health`

No authentication. Liveness only; says nothing about configuration.

---

## MCP

`POST /api/mcp` speaks JSON-RPC 2.0 over the Streamable HTTP transport, in its
stateless form — one request, one response, no session to resume. Supported
methods: `initialize`, `ping`, `tools/list`, `tools/call`.

```bash
curl -X POST https://<your-host>/api/mcp \
  -H "Authorization: Bearer sam_live_…" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Tools map onto the endpoints above: `get_community`, `list_announcements`,
`post_announcement`, `list_service_requests`, `get_service_request`,
`create_service_request`, `comment_on_request`, `list_visitors`,
`create_visitor_pass`, `list_amenities`, `list_invoices`, `list_members`.

`tools/list` returns only what the key's scopes allow, so an assistant is never
shown a tool that will then fail. A tool that errors reports it inside the
result (`isError: true`) rather than as a protocol error, so the model can read
the message and correct itself.

**The write tools reach real people.** `post_announcement` notifies every
resident. `create_service_request` files a ticket staff will work. The server's
`initialize` response says so in its instructions, but an assistant holding a
write-scoped key can act on the community — scope keys to what the integration
actually needs.
