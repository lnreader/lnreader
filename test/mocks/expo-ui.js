// The Compose module is native-only; give tests a deterministic Material 3
// baseline palette. A seed colour replaces `primary` so theme tests can tell
// seeded palettes apart without a real tonal-spot implementation.
const mockLight = {
  primary: '#6750A4FF',
  onPrimary: '#FFFFFFFF',
  primaryContainer: '#EADDFFFF',
  onPrimaryContainer: '#21005DFF',
  inversePrimary: '#D0BCFFFF',
  secondary: '#625B71FF',
  onSecondary: '#FFFFFFFF',
  secondaryContainer: '#E8DEF8FF',
  onSecondaryContainer: '#1D192BFF',
  tertiary: '#7D5260FF',
  onTertiary: '#FFFFFFFF',
  tertiaryContainer: '#FFD8E4FF',
  onTertiaryContainer: '#31111DFF',
  background: '#FEF7FFFF',
  onBackground: '#1D1B20FF',
  surface: '#FEF7FFFF',
  onSurface: '#1D1B20FF',
  surfaceVariant: '#E7E0ECFF',
  onSurfaceVariant: '#49454FFF',
  surfaceTint: '#6750A4FF',
  inverseSurface: '#322F35FF',
  inverseOnSurface: '#F5EFF7FF',
  error: '#B3261EFF',
  onError: '#FFFFFFFF',
  errorContainer: '#F9DEDCFF',
  onErrorContainer: '#410E0BFF',
  outline: '#79747EFF',
  outlineVariant: '#CAC4D0FF',
  scrim: '#000000FF',
  surfaceBright: '#FEF7FFFF',
  surfaceDim: '#DED8E1FF',
  surfaceContainer: '#F3EDF7FF',
  surfaceContainerHigh: '#ECE6F0FF',
  surfaceContainerHighest: '#E6E0E9FF',
  surfaceContainerLow: '#F7F2FAFF',
  surfaceContainerLowest: '#FFFFFFFF',
  primaryFixed: '#EADDFFFF',
  primaryFixedDim: '#D0BCFFFF',
  onPrimaryFixed: '#21005DFF',
  onPrimaryFixedVariant: '#4F378BFF',
  secondaryFixed: '#E8DEF8FF',
  secondaryFixedDim: '#CCC2DCFF',
  onSecondaryFixed: '#1D192BFF',
  onSecondaryFixedVariant: '#4A4458FF',
  tertiaryFixed: '#FFD8E4FF',
  tertiaryFixedDim: '#EFB8C8FF',
  onTertiaryFixed: '#31111DFF',
  onTertiaryFixedVariant: '#633B48FF',
};

const mockDark = {
  ...mockLight,
  primary: '#D0BCFFFF',
  onPrimary: '#381E72FF',
  primaryContainer: '#4F378BFF',
  onPrimaryContainer: '#EADDFFFF',
  inversePrimary: '#6750A4FF',
  secondary: '#CCC2DCFF',
  onSecondary: '#332D41FF',
  secondaryContainer: '#4A4458FF',
  onSecondaryContainer: '#E8DEF8FF',
  tertiary: '#EFB8C8FF',
  onTertiary: '#492532FF',
  tertiaryContainer: '#633B48FF',
  onTertiaryContainer: '#FFD8E4FF',
  background: '#141218FF',
  onBackground: '#E6E0E9FF',
  surface: '#141218FF',
  onSurface: '#E6E0E9FF',
  surfaceVariant: '#49454FFF',
  onSurfaceVariant: '#CAC4D0FF',
  surfaceTint: '#D0BCFFFF',
  inverseSurface: '#E6E0E9FF',
  inverseOnSurface: '#322F35FF',
  error: '#F2B8B5FF',
  onError: '#601410FF',
  errorContainer: '#8C1D18FF',
  onErrorContainer: '#F9DEDCFF',
  outline: '#938F99FF',
  outlineVariant: '#49454FFF',
  surfaceBright: '#3B383EFF',
  surfaceDim: '#141218FF',
  surfaceContainer: '#211F26FF',
  surfaceContainerHigh: '#2B2930FF',
  surfaceContainerHighest: '#36343BFF',
  surfaceContainerLow: '#1D1B20FF',
  surfaceContainerLowest: '#0F0D13FF',
};

const mockToHex8 = color => {
  if (typeof color !== 'string') return undefined;
  const hex = color.replace('#', '').toUpperCase();
  if (hex.length === 6) return `#${hex}FF`;
  if (hex.length === 8) return `#${hex}`;
  return undefined;
};

jest.mock(
  '../../node_modules/@expo/ui/src/jetpack-compose/ExpoUIModule',
  () => ({
    ExpoUIModule: {
      isDynamicColorAvailable: false,
      getMaterialColors: options => {
        const palette = options?.scheme === 'dark' ? mockDark : mockLight;
        const seed = mockToHex8(options?.seedColor);
        return seed ? { ...palette, primary: seed } : { ...palette };
      },
    },
  }),
);

global.mockMaterialPalettes = { light: mockLight, dark: mockDark };
