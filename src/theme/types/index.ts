export interface MD3ThemeType {
  id: number;
  name: string;
  isDark: boolean;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  surfaceDisabled: string;
  onSurfaceDisabled: string;
  backdrop: string;
}

export interface ThemeColors extends MD3ThemeType {
  rippleColor?: string;
  surfaceContainerLow?: string;
  surfaceContainer?: string;
  surfaceContainerHigh?: string;
  surfaceContainerHighest?: string;
  surface2?: string;
  overlay3?: string;
  surfaceReader?: string;
}

/** A theme with the surfaces the app derives for it (see useTheme). */
export type AppThemeColors = ThemeColors &
  Required<
    Pick<
      ThemeColors,
      | 'surfaceContainerLow'
      | 'surfaceContainer'
      | 'surfaceContainerHigh'
      | 'surfaceContainerHighest'
    >
  >;
