import {
  getMaterial3Theme,
  isDynamicThemeSupported,
  type Material3Theme,
} from '@pchmn/expo-material3-theme';

import { getString } from '@i18n/translations';
import type { ThemeColors } from '@theme/types';

export const DYNAMIC_THEME_ID = -1;
const DYNAMIC_THEME_FALLBACK_COLOR = '#0057CE';

export const isDynamicThemeAvailable = isDynamicThemeSupported;

export const getSystemDynamicTheme = (): Material3Theme =>
  getMaterial3Theme(DYNAMIC_THEME_FALLBACK_COLOR);

export const toDynamicThemeColors = (
  dynamicTheme: Material3Theme,
  isDark: boolean,
): ThemeColors => ({
  ...(isDark ? dynamicTheme.dark : dynamicTheme.light),
  id: DYNAMIC_THEME_ID,
  name: getString('appearanceScreen.dynamicColors'),
  isDark,
});
