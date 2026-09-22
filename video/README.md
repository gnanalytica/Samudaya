# The Samudaya demo video

Two cuts of one video, built from the app's own components:

| Composition   | Length | For                                                        |
| ------------- | ------ | ---------------------------------------------------------- |
| `Walkthrough` | ~1:32  | A committee deciding whether to put their money in this.     |
| `Launch`      | ~0:41  | A landing page, or a forward into a society's WhatsApp group.|

Captions, no voiceover — most of the people this reaches will watch it on mute.

## Why it is built this way

The product is a ledger, so the shots have to be the ledger. Two things make
that awkward, and the pipeline exists to get around both:

- **The pages are behind a sign-in**, so there is nothing for a screen
  recorder to point at without a seeded database and a session.
- **The data is real neighbours and real payments.** The Money page names who
  paid and how much, which is the one thing that must never be in a video.

So `capture/` mounts the real components — `LedgerRow`, `ContributeForm`,
`FestivalNameField`, `AllocateSurplusForm` — on throwaway routes with an
invented society, films those, and deletes the routes again in the same run.
Real components, real CSS, real layout, invented people. Nothing is mocked up
in a design tool, and nothing that ships was touched: the staged routes never
reach a commit, and `apps/web` is byte-identical when the script finishes.

This directory is deliberately outside the pnpm workspace (`apps/*`,
`packages/*`), so CI never builds, lints or typechecks a video.

## Making it

```bash
cd video
npm install

npm run capture   # films the app; needs apps/web's deps installed at the repo root
npm run render    # both cuts into out/
```

`npm run studio` opens Remotion's editor for scrubbing a scene while you
change it.

Rendering needs a Chromium that still supports old headless mode. In CI-ish
environments where Playwright's browsers are already on disk, point Remotion at
its headless shell:

```bash
npx remotion render src/index.ts Launch out/samudaya-launch.mp4 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

## Changing it

- **The script** is `src/scenes.tsx` — one entry per scene, each with the
  length it wants. `src/Root.tsx` picks which scenes each cut uses and how
  long to hold them, so re-cutting is a list edit rather than a new timeline.
- **The look** is `src/theme.ts`, which is the app's palette copied verbatim
  from `apps/web/src/app/globals.css`. Retune it there and here together.
- **The shots** are `capture/harness/*/page.tsx`. Change the fabricated society
  there, re-run `npm run capture`, and every scene updates.

`public/captures/` and `out/` are generated and git-ignored; both are rebuilt
by the two commands above.

### A note on the recordings

`clips.json` is written by the capture and read by `scenes.tsx`. A Playwright
recording opens on a blank page and a navigation — around two and a half
seconds of nothing on the festival clip — so the capture times the interaction
with the wall clock and writes down where it starts. Re-recording on a slower
day cannot quietly push the interaction past the end of its scene.
