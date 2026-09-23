# The Samudaya demo video

Two cuts of one video, filmed from the app itself:

| Composition   | Length | For                                                           |
| ------------- | ------ | ------------------------------------------------------------- |
| `Walkthrough` | ~1:27  | A committee deciding whether to put their money in this.      |
| `Launch`      | ~0:30  | A landing page, or a forward into a society's WhatsApp group. |
| `Phone`       | ~0:34  | Portrait, for a status, a Reel, or anywhere held upright.     |

Captions and a score, no voiceover — most of the people this reaches will
watch it on mute, and the ones who don't get something under it.

## Why it is built this way

The product is a ledger, so the shots have to be the ledger. Two things make
that awkward, and the pipeline exists to get around both:

- **The pages are behind a sign-in**, so there is nothing for a screen
  recorder to point at without a seeded database and a session.
- **The data is real neighbours and real payments.** The Money page names who
  paid and how much, which is the one thing that must never be in a video.

So `capture/stage.mjs` writes an invented society into `apps/web` — Shanti
Nivas, twenty-four flats, a Ganesh Chaturthi fund — and patches the proxy to
serve it at `/app/shanti-nivas`, which is the path the app's own navigation
builds. That last part is the whole trick: `SidebarNav` makes every href from
the slug and lights the active one from `usePathname()`, so a demo served at
its own path would have a sidebar that navigates nowhere. Served where the app
expects it, clicking Money loads the real Money page through a real client-side
transition. The shell, the switcher, the profile menu, the bottom bar and every
row are the app's own components. Only the residents are made up.

The staged pages sit where the app would put them — the sidebar's Reconcile
link points at `/admin/reconcile`, so the harness page does too. A page at the
wrong path is a click that lands on a 404 in the middle of a take.

Both scripts remove everything they wrote before they exit, so no page that
exists only to be filmed can reach a commit or a build.

This directory is deliberately outside the pnpm workspace (`apps/*`,
`packages/*`), so CI never builds, lints or typechecks a video. It is still
covered by the repo-wide `pnpm format:check`.

## Making it

```bash
cd video
npm install

npm run record        # one continuous take at a desktop window → take.webm
npm run record:phone  # the same society through the mobile layout → phone.webm
npm run capture   # the stills and the one-control clips
npm run score     # synthesises the music bed for each cut
npm run render    # both cuts into out/
npm run landing   # the 720p copy the landing page serves
```

`npm run studio` opens Remotion's editor for scrubbing a scene while you
change it.

### The portrait cut is a second recording, not a crop

Most of a society reads its ledger standing in a lift, and a landscape video
cropped to a phone is a landscape video with its sides cut off. So `Phone` is
built from `capture/record-phone.mjs`, which drives the app at a phone's
viewport — where the sidebar becomes a sheet behind the society's name, a
four-slot bar appears along the bottom, and Money gives up its slot to Manage
for anybody on the committee, so the ledger is reached through the sheet. None
of that layout exists in the landscape take.

Its pointer is a finger rather than an arrow. `capture/drive.mjs` holds both,
along with the eased moves and the scroll-to-target both recorders use; a phone
has no cursor and drawing one would be a small lie about how the app is used.

Two things that bit, in case they bite again:

- **Playwright records at the viewport's CSS pixels.** Asking for a phone's 3x
  device pixels does not render sharper, it pads: a 390-wide page ends up in the
  corner of a 1170-wide grey frame. The take is captured 1:1 and the composition
  scales it, which is what a screen recording looks like anyway.
- **A phone stacks the two-column pages**, so a control beside the fold on a
  desktop is a long way below it here. `reachAndPress` scrolls to a thing before
  pressing it; a fixed offset lands on whatever moved into that space, which is
  how a take ends in a twenty-second timeout.

Rendering needs a Chromium that still supports old headless mode; Playwright's
`chromium` is not one. The render scripts already point at the headless shell
beside it, which is.

## Changing it

- **The script** is `src/scenes.tsx` — one entry per scene, each with the
  length it wants. `src/Root.tsx` picks which scenes each cut uses and how long
  to hold them, so re-cutting is a list edit rather than a new timeline.
- **The look** is `src/theme.ts`, the app's palette copied verbatim from
  `apps/web/src/app/globals.css`, and `src/festive.tsx`, which ports the kolam
  and the toran out of `apps/web/src/components/festival.tsx` along with Ganesh
  Chaturthi's colours from `packages/core/src/festivals.ts`. Retune them
  together.

  That festival dressing is the app's, not the video's. Samudaya re-points its
  whole palette per festival — `festivalVars` makes `--accent` marigold on a
  Ganesh page — and draws a kolam and a toran on Home, the events list and
  every event page. The first cut of this video used plain headers in the
  harness and so filmed the entire product in its default green, which is the
  app with its clothes off. Contribute, Money and Reconcile are _not_ dressed
  in the real app, so they are not dressed here either.

- **The words** are captions in `src/scenes.tsx`. They are marketing copy, not
  documentation: what it does for a committee, not how it is implemented. "Every
  rupee out, with the bill attached" rather than a sentence about approval
  trails.
- **The journey** is `capture/record.mjs` — where the cursor goes, what it
  clicks, how long it reads. Every stop is a named beat.
- **The society** is `capture/harness/society/demo-data.ts`. One file, so the
  total on Home is the total on Money, the event the ledger credits is the event
  the Events page lists, and the figures the WhatsApp bot quotes are the ones on
  the screen before it.
- **The two drawn scenes** are `src/surfaces.tsx`. Samudaya has four surfaces
  and a screen recorder can only point at two: filming WhatsApp would mean
  photographing somebody else's app, and an MCP server has no pixels at all. So
  those are animated, in the app's palette, from the app's own source — every
  command from `packages/core/src/whatsapp/commands.ts`, every tool name and
  scope from `apps/web/src/lib/api/mcp-tools.ts`.

  A drawing can claim anything, so `apps/web/test/demo-video-claims.test.ts`
  checks both against those files. The first draft of the MCP scene invented
  four scope names that read perfectly and matched nothing.

- **The music** is `score/compose.mjs`: plucked notes with harmonics that decay
  at different rates, two detuned sines per pad voice, D major pentatonic at
  68bpm, no percussion. Written rather than licensed, because every other way
  of getting a bed ends in a licence nobody on a committee can produce two
  years later. It normalises to half scale, leaving about seven decibels for a
  voiceover to sit on top of without a remix.

`public/captures/`, `public/score-*.wav` and `out/` are generated and
git-ignored; the commands above rebuild all of them.

### The three files that are generated and committed

`scenes.tsx` imports them, so a clean clone has to typecheck before anybody has
run a capture.

- **`src/beats.json`** — every moment in the take, in seconds. The edit says
  "two seconds before Money opened" rather than a frame number that the next
  recording would invalidate. It also carries `lead`: Playwright starts
  recording when the browser context opens, which is about three seconds before
  the first navigation, so every beat is that much later in the file than in
  the log. Measured from the file's own duration against the wall clock, not
  guessed — guess it and the whole cut runs early.
- **`src/clips.json`** — the same idea for the short single-control clips.
- **`src/shots.json`** — what each still actually came out as. Shots are taken
  `fullPage`, so their height is whatever the content needed that day; Remotion
  pans by subtracting the viewport from it. Typed in by hand, that number goes
  wrong silently the first time a ledger row is added.

### What is not here yet

Filming the real production app, signed in. That needs a session, which needs
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and a way to mint a
token, none of which belong in a repository. The staged society is the honest
substitute: the same components and the same navigation, with residents who do
not exist.
