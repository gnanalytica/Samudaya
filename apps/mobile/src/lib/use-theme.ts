import { useColorScheme } from 'react-native';
import { palette, type Palette } from './theme';

/** Colours for the device's current appearance setting. */
export function useTheme(): { colors: Palette; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? palette.dark : palette.light, isDark };
}
