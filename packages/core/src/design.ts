/**
 * The app's colours, in one place for both apps.
 *
 * Ivory paper, warm ink and a little gold; the one strong colour on a screen
 * is whatever the society is celebrating (festivals.ts). The web writes these
 * into globals.css as custom properties — a test holds the two to each other —
 * and the phone converts them to the hex React Native reads (colour.ts).
 */

export type Tokens = {
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  /** Section labels and hairlines: the one ornament that is not the festival's. */
  gold: string;
  /** The society's own colours, which a festival's replace. */
  accent: string;
  accentInk: string;
  ribbon: string;
  wash: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
};

export const TOKENS: Readonly<Record<'light' | 'dark', Tokens>> = {
  light: {
    surface: 'oklch(0.972 0.007 84)',
    surfaceRaised: 'oklch(1 0 0)',
    surfaceSunken: 'oklch(0.945 0.011 82)',
    border: 'oklch(0.905 0.014 80)',
    borderStrong: 'oklch(0.83 0.02 78)',
    ink: 'oklch(0.205 0.012 70)',
    inkMuted: 'oklch(0.47 0.02 72)',
    inkSubtle: 'oklch(0.56 0.02 74)',
    gold: 'oklch(0.53 0.075 75)',
    accent: 'oklch(0.48 0.09 165)',
    accentInk: 'oklch(1 0 0)',
    ribbon: 'oklch(0.62 0.09 80)',
    wash: 'oklch(0.975 0.012 150)',
    danger: 'oklch(0.53 0.19 27)',
    warning: 'oklch(0.56 0.13 60)',
    success: 'oklch(0.5 0.12 158)',
    info: 'oklch(0.52 0.11 250)',
  },
  dark: {
    surface: 'oklch(0.165 0.006 70)',
    surfaceRaised: 'oklch(0.205 0.008 70)',
    surfaceSunken: 'oklch(0.14 0.005 70)',
    border: 'oklch(0.29 0.012 70)',
    borderStrong: 'oklch(0.38 0.014 70)',
    ink: 'oklch(0.955 0.01 80)',
    inkMuted: 'oklch(0.74 0.018 78)',
    inkSubtle: 'oklch(0.62 0.018 75)',
    gold: 'oklch(0.8 0.08 80)',
    accent: 'oklch(0.76 0.1 165)',
    accentInk: 'oklch(0.18 0.02 70)',
    ribbon: 'oklch(0.8 0.09 82)',
    wash: 'oklch(0.235 0.018 160)',
    danger: 'oklch(0.7 0.17 25)',
    warning: 'oklch(0.8 0.13 75)',
    success: 'oklch(0.75 0.13 158)',
    info: 'oklch(0.73 0.1 250)',
  },
};

/** What a motif draws a flame, a star or a lantern in, on a festival's banner. */
export const MOTIF_LIGHT = '#ffd98a';
