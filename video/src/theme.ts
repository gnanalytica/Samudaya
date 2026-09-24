import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

/**
 * The app's own tokens, copied verbatim from apps/web/src/app/globals.css.
 *
 * Copied rather than imported: the web app's palette lives in a Tailwind v4
 * `@theme` block that only means anything to Tailwind's compiler, and Remotion
 * renders plain React. Same oklch values, so a title card and a screenshot of
 * the product sit in the same colour space instead of nearly matching — which
 * is the tell that a demo video was made by somebody who does not work on the
 * thing they are demoing.
 */
export const color = {
  surface: 'oklch(0.993 0.005 85)',
  surfaceRaised: 'oklch(1 0 0)',
  surfaceSunken: 'oklch(0.964 0.008 85)',
  border: 'oklch(0.898 0.009 85)',
  borderStrong: 'oklch(0.818 0.013 85)',
  ink: 'oklch(0.235 0.014 75)',
  inkMuted: 'oklch(0.515 0.013 75)',
  inkSubtle: 'oklch(0.635 0.011 75)',
  accent: 'oklch(0.53 0.13 166)',
  accentInk: 'oklch(1 0 0)',
  accentDeep: 'oklch(0.31 0.07 169)',
  accentDeeper: 'oklch(0.2 0.048 170)',
  success: 'oklch(0.53 0.13 166)',
  warning: 'oklch(0.55 0.13 65)',
} as const;

/** The app ships no webfont, so the screens drawn from it do not either. */
export const fontFamily =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

/**
 * The landing page's display face (apps/web/src/app/_landing/font.ts), for
 * the video's own titles: the opening card, the statements, each shot's
 * headline, the cover and the wordmark in the sting. The video plays on that
 * page, and a title set in a different face beside its headings reads as a
 * clip from somewhere else.
 *
 * Baloo 2 is a variable font, one file per script. It ships in public/fonts
 * (SIL Open Font License, OFL.txt beside it) rather than being fetched from
 * Google at render time, so a render needs no network and gets the same
 * letters every time — which is also how next/font serves it to the page.
 * Latin and Devanagari, the two the page loads; the render waits for both.
 */
const DISPLAY = 'Baloo 2';
const DISPLAY_FACES = [
  {
    file: 'fonts/baloo2-latin.woff2',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    file: 'fonts/baloo2-devanagari.woff2',
    unicodeRange:
      'U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B09',
  },
];

if (typeof document !== 'undefined') {
  const waiting = delayRender(`Loading ${DISPLAY}`);
  Promise.all(
    DISPLAY_FACES.map(({ file, unicodeRange }) => {
      const face = new FontFace(DISPLAY, `url('${staticFile(file)}') format('woff2')`, {
        weight: '400 800',
        unicodeRange,
      });
      document.fonts.add(face);
      return face.load();
    }),
  ).then(() => continueRender(waiting), cancelRender);
}

export const displayFamily = `'${DISPLAY}', ${fontFamily}`;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Seconds → frames, so scene lengths read as durations in the timeline. */
export const sec = (seconds: number) => Math.round(seconds * FPS);
