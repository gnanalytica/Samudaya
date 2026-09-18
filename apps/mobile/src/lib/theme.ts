/**
 * Mirrors the web app's tokens so the two surfaces look like one product.
 * Values are resolved per colour scheme rather than via CSS variables, which
 * React Native has no equivalent for.
 */
export type Palette = {
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  accent: string;
  accentInk: string;
  danger: string;
  warning: string;
  success: string;
};

export const palette: Record<'light' | 'dark', Palette> = {
  light: {
    surface: '#fbfdfc',
    surfaceRaised: '#ffffff',
    surfaceSunken: '#f1f5f4',
    border: '#dfe6e4',
    ink: '#16211e',
    inkMuted: '#5d6b67',
    inkSubtle: '#8a9793',
    accent: '#0f766e',
    accentInk: '#ffffff',
    danger: '#c2410c',
    warning: '#b45309',
    success: '#15803d',
  },
  dark: {
    surface: '#101c19',
    surfaceRaised: '#16241f',
    surfaceSunken: '#0c1714',
    border: '#2a3a35',
    ink: '#eef5f2',
    inkMuted: '#9fb0aa',
    inkSubtle: '#75857f',
    accent: '#5eead4',
    accentInk: '#0c1f1b',
    danger: '#fb923c',
    warning: '#fbbf24',
    success: '#4ade80',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/**
 * The smallest a tappable thing may be, in points.
 *
 * Apple asks for 44, Android for 48dp, and WCAG 2.5.5 for 44 — so 44 is the
 * floor everything must clear, not the size everything should be. Button and
 * Input already sit above it at 48 and are left alone; this is for the smaller
 * controls, where a pill sized to its text ends up around 30 and a row around
 * 36. The pill keeps its looks: it is the target that grows, not the type.
 */
export const minTapTarget = 44;

/**
 * Extra touch area for a small inline link, without moving anything.
 *
 * A 13–14px link is about 16–18 points tall, and `hitSlop={8}` — the habit in
 * this codebase — only lifts it to the low thirties. Fourteen top and bottom
 * clears 44. Horizontal stays at 8: these links sit beside other controls, and
 * a wide slop would start swallowing taps meant for the neighbour.
 */
export const tapSlop = { top: 14, bottom: 14, left: 8, right: 8 } as const;
