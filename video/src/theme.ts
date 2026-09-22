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

/** The app ships no webfont, so neither does this. */
export const fontFamily =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Seconds → frames, so scene lengths read as durations in the timeline. */
export const sec = (seconds: number) => Math.round(seconds * FPS);
