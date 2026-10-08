import React, { useMemo } from 'react';
import { Column, FlowRow } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import {
  useMMKVBoolean,
  useMMKVNumber,
  useMMKVString,
} from 'react-native-mmkv';
import { SegmentedControl, SwitchItem } from '@components';
import type { SegmentedControlOption } from '@components/SegmentedControl';
import { ThemePicker } from '@components/ThemePicker/ThemePicker';
import { ThemeColors } from '@theme/types';
import { useTheme } from '@hooks/persisted';
import { darkThemes, lightThemes } from '@theme/md3';
import {
  getSystemDynamicTheme,
  isDynamicThemeAvailable,
  toDynamicThemeColors,
} from '@theme/dynamic';
import { getString } from '@i18n/translations';

type ThemeMode = 'light' | 'dark' | 'system';

interface AmoledToggleProps {
  theme: ThemeColors;
}

const AmoledToggle: React.FC<AmoledToggleProps> = ({ theme }) => {
  const [isAmoledBlack = false, setAmoledBlack] =
    useMMKVBoolean('AMOLED_BLACK');

  const toggle = () => setAmoledBlack(!isAmoledBlack);

  if (!theme.isDark) return null;

  return (
    <SwitchItem
      label={getString('appearanceScreen.pureBlackDarkMode')}
      value={isAmoledBlack}
      onPress={toggle}
      theme={theme}
    />
  );
};

export default function ThemeSelectionStep() {
  const theme = useTheme();
  const [themeMode = 'system', setThemeMode] = useMMKVString('THEME_MODE');
  const [, setThemeId] = useMMKVNumber('APP_THEME_ID');

  const currentMode = themeMode as ThemeMode;

  const availableThemes = useMemo(() => {
    const themes = theme.isDark ? darkThemes : lightThemes;
    if (!isDynamicThemeAvailable) {
      return themes;
    }

    return [
      toDynamicThemeColors(getSystemDynamicTheme(), theme.isDark),
      ...themes,
    ];
  }, [theme]);

  const themeModeOptions: SegmentedControlOption<ThemeMode>[] = useMemo(
    () => [
      {
        value: 'system',
        label: getString('onboardingScreen.system'),
      },
      {
        value: 'light',
        label: getString('onboardingScreen.light'),
      },
      {
        value: 'dark',
        label: getString('onboardingScreen.dark'),
      },
    ],
    [],
  );

  const handleModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const handleThemeSelect = (selectedTheme: ThemeColors) => {
    setThemeId(selectedTheme.id);
  };

  return (
    <Column
      verticalArrangement={{ spacedBy: 24 }}
      modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}
    >
      <SegmentedControl
        options={themeModeOptions}
        value={currentMode}
        onChange={handleModeChange}
        theme={theme}
      />
      <FlowRow
        horizontalArrangement={{ spacedBy: 12 }}
        verticalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth()]}
      >
        {availableThemes.map(item => (
          <ThemePicker
            key={'theme-' + item.id}
            currentTheme={theme}
            theme={item}
            onPress={() => handleThemeSelect(item)}
          />
        ))}
      </FlowRow>
      <AmoledToggle theme={theme} />
    </Column>
  );
}
