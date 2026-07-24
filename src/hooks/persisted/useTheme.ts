import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  PropsWithChildren,
} from 'react';
import { Appearance, AppState, ColorSchemeName } from 'react-native';
import {
  useMMKVBoolean,
  useMMKVNumber,
  useMMKVString,
} from 'react-native-mmkv';
import type { Material3Theme } from '@pchmn/expo-material3-theme';
import { overlay } from 'react-native-paper';
import Color from 'color';

import { ThemeColors } from '@theme/types';
import { darkThemes, lightThemes } from '@theme/md3';
import {
  DYNAMIC_THEME_ID,
  getSystemDynamicTheme,
  isDynamicThemeAvailable,
  toDynamicThemeColors,
} from '@theme/dynamic';

const getElevationColor = (colors: ThemeColors, elevation: number): string => {
  return Color(colors.surface)
    .mix(Color(colors.primary), elevation)
    .rgb()
    .string();
};

const getSurfaceContainerHigh = (colors: ThemeColors): string =>
  Color(colors.surface)
    .mix(Color(colors.onSurface), colors.isDark ? 0.1 : 0.08)
    .rgb()
    .string();

const getSurfaceContainerLow = (colors: ThemeColors): string =>
  Color(colors.surface)
    .mix(Color(colors.onSurface), colors.isDark ? 0.05 : 0.04)
    .rgb()
    .string();

const addComputedColors = (colors: ThemeColors): ThemeColors => ({
  ...colors,
  surfaceContainerLow: getSurfaceContainerLow(colors),
  surfaceContainerHigh: getSurfaceContainerHigh(colors),
  surface2: getElevationColor(colors, 0.08),
  overlay3: overlay(3, colors.surface),
  rippleColor: Color(colors.primary).alpha(0.12).toString(),
  surfaceReader: Color(colors.surface).alpha(0.9).toString(),
});

const applyAmoledBlack = (
  colors: ThemeColors,
  isEnabled: boolean,
): ThemeColors => {
  if (!isEnabled || !colors.isDark) {
    return colors;
  }

  return {
    ...colors,
    background: '#000000',
    surface: '#000000',
  };
};

const applyCustomAccent = (
  colors: ThemeColors,
  accentColor?: string,
): ThemeColors => {
  if (!accentColor) {
    return colors;
  }

  return {
    ...colors,
    primary: accentColor,
    secondary: accentColor,
  };
};

const findThemeById = (
  themeId: number | undefined,
  isDark: boolean,
): ThemeColors => {
  const themeList = isDark ? darkThemes : lightThemes;
  let theme: ThemeColors | undefined;
  if (themeId !== undefined) {
    const id = transformThemeId(themeId, isDark);
    theme = themeList.find(t => t.id === id);
  }

  return theme ?? themeList[0];
};

// transforms legacy theme IDs to new IDs
function transformThemeId(themeId: number, isDark: boolean): number {
  if (themeId > 99) return themeId;
  const lightIdMap: Record<number, number> = {
    '1': 100,
    '8': 102,
    '9': 108,
    '10': 101,
    '12': 103,
    '14': 104,
    '16': 105,
    '18': 106,
    '20': 107,
  };
  const darkIdMap: Record<number, number> = {
    '2': 100,
    '9': 102,
    '10': 108,
    '11': 101,
    '13': 103,
    '15': 104,
    '17': 105,
    '19': 106,
    '21': 107,
  };
  if (isDark) {
    return darkIdMap[themeId] ?? themeId;
  }
  return lightIdMap[themeId] ?? themeId;
}

const getBaseTheme = (
  themeMode: string,
  themeId: number | undefined,
  systemColorScheme: ColorSchemeName,
  dynamicTheme: Material3Theme,
): ThemeColors => {
  const isDark =
    themeMode === 'system'
      ? systemColorScheme === 'dark'
      : themeMode === 'dark';

  if (themeId === DYNAMIC_THEME_ID && isDynamicThemeAvailable) {
    return toDynamicThemeColors(dynamicTheme, isDark);
  }

  if (themeMode === 'system') {
    return findThemeById(themeId, isDark);
  }

  return findThemeById(themeId, isDark);
};

const ThemeContext = createContext<ThemeColors | null>(null);

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [themeId] = useMMKVNumber('APP_THEME_ID');
  const [themeMode = 'system'] = useMMKVString('THEME_MODE');
  const [isAmoledBlack = false] = useMMKVBoolean('AMOLED_BLACK');
  const [customAccent] = useMMKVString('CUSTOM_ACCENT_COLOR');

  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? 'unspecified',
  );
  const [dynamicTheme, setDynamicTheme] = useState(getSystemDynamicTheme);

  useEffect(() => {
    const appearanceSubscription = Appearance.addChangeListener(
      ({ colorScheme }) => {
        setSystemColorScheme(colorScheme);
      },
    );
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active' && isDynamicThemeAvailable) {
        setDynamicTheme(getSystemDynamicTheme());
      }
    });

    return () => {
      appearanceSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const theme = useMemo<ThemeColors>(() => {
    const baseTheme = getBaseTheme(
      themeMode,
      themeId,
      systemColorScheme,
      dynamicTheme,
    );
    const withAmoled = applyAmoledBlack(baseTheme, isAmoledBlack);
    const withAccent = applyCustomAccent(withAmoled, customAccent);
    const finalTheme = addComputedColors(withAccent);

    return finalTheme;
  }, [
    themeId,
    themeMode,
    systemColorScheme,
    dynamicTheme,
    isAmoledBlack,
    customAccent,
  ]);

  return createElement(ThemeContext.Provider, { value: theme }, children);
};

export const useTheme = (): ThemeColors => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    // eslint-disable-next-line no-console
    console.error('useTheme must be used within a <ThemeProvider />');
    return {} as ThemeColors;
  }

  return theme;
};
