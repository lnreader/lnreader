import { StatusBar } from 'react-native';
import Color from 'color';

import type { ChapterReaderSettings } from '@hooks/persisted/useSettings';
import type { ThemeColors } from '@theme/types';

// The variables the old reader page defined, so custom CSS using them keeps
// working.
export const readerCssVariables = (
  reader: ChapterReaderSettings,
  theme: ThemeColors,
): Record<string, string> => ({
  'StatusBar-currentHeight': `${StatusBar.currentHeight ?? 0}px`,
  'readerSettings-theme': reader.theme,
  'readerSettings-padding': `${reader.padding}px`,
  'readerSettings-textSize': `${reader.textSize}px`,
  'readerSettings-textColor': reader.textColor,
  'readerSettings-textAlign': reader.textAlign,
  'readerSettings-lineHeight': String(reader.lineHeight),
  'readerSettings-fontFamily': reader.fontFamily || 'inherit',
  'theme-primary': theme.primary,
  'theme-onPrimary': theme.onPrimary,
  'theme-secondary': theme.secondary,
  'theme-tertiary': theme.tertiary,
  'theme-onTertiary': theme.onTertiary,
  'theme-onSecondary': theme.onSecondary,
  'theme-surface': theme.surface,
  'theme-surface-0-9': Color(theme.surface).alpha(0.9).hexa(),
  'theme-onSurface': theme.onSurface,
  'theme-surfaceVariant': theme.surfaceVariant,
  'theme-onSurfaceVariant': theme.onSurfaceVariant,
  'theme-outline': theme.outline,
  'theme-outlineVariant': theme.outlineVariant,
  'theme-rippleColor': theme.rippleColor ?? '',
});
