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
