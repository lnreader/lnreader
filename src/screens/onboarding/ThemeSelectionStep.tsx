import React, { useMemo } from 'react';
import { Alert, View, Text, Pressable, StyleSheet } from 'react-native';
import {
  useMMKVBoolean,
  useMMKVNumber,
  useMMKVString,
} from 'react-native-mmkv';
import { SegmentedControl } from '@components';
import type { SegmentedControlOption } from '@components/SegmentedControl';
import { ThemePicker } from '@components/ThemePicker/ThemePicker';
import { ThemeColors } from '@theme/types';
import { useTheme } from '@hooks/persisted';
import { useEPaperOptimizations } from '@hooks/persisted/useEPaperOptimizations';
import { darkThemes, lightThemes, E_PAPER_THEME_ID } from '@theme/md3';
import {
  getSystemDynamicTheme,
  isDynamicThemeAvailable,
  toDynamicThemeColors,
} from '@theme/dynamic';
import { getString } from '@i18n/translations';
import { LegendList } from '@legendapp/list/react-native';
import Switch from '@components/Switch/Switch';

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
    <Pressable
      style={[
        styles.amoledContainer,
        { backgroundColor: theme.surfaceVariant },
      ]}
      onPress={toggle}
    >
      <Text style={[styles.amoledLabel, { color: theme.onSurface }]}>
        {getString('appearanceScreen.pureBlackDarkMode')}
      </Text>
      <Switch value={isAmoledBlack} onValueChange={toggle} />
    </Pressable>
  );
};

export default function ThemeSelectionStep() {
  const theme = useTheme();
  const [themeMode = 'system', setThemeMode] = useMMKVString('THEME_MODE');
  const [, setThemeId] = useMMKVNumber('APP_THEME_ID');
  const {
    ePaperOptimizations,
    applyEPaperOptimizations,
    disableEPaperOptimizations,
  } = useEPaperOptimizations();

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
    if (selectedTheme.id === E_PAPER_THEME_ID) {
      setThemeId(selectedTheme.id);
      if (theme.id !== E_PAPER_THEME_ID && !ePaperOptimizations) {
        applyEPaperOptimizations();
      }
      return;
    }

    if (theme.id === E_PAPER_THEME_ID && ePaperOptimizations) {
      Alert.alert(
        getString('appearanceScreen.ePaperLeaveTitle'),
        getString('appearanceScreen.ePaperLeaveDescription'),
        [
          {
            text: getString('appearanceScreen.ePaperKeep'),
            onPress: () => setThemeId(selectedTheme.id),
          },
          {
            text: getString('appearanceScreen.ePaperRestore'),
            onPress: () => {
              disableEPaperOptimizations();
              setThemeId(selectedTheme.id);
            },
          },
        ],
      );
      return;
    }

    setThemeId(selectedTheme.id);
  };

  return (
    <View style={styles.container}>
      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <SegmentedControl
          options={themeModeOptions}
          value={currentMode}
          onChange={handleModeChange}
          theme={theme}
        />
      </View>
      {/* Theme List */}
      <LegendList
        numColumns={3}
        showsHorizontalScrollIndicator={false}
        data={availableThemes}
        extraData={[theme, ePaperOptimizations]}
        keyExtractor={item => 'theme-' + item.id}
        renderItem={({ item }) => (
          <View>
            <ThemePicker
              currentTheme={theme}
              theme={item}
              onPress={() => handleThemeSelect(item)}
            />
          </View>
        )}
      />
      {theme.id === E_PAPER_THEME_ID && (
        <Pressable
          style={styles.amoledContainer}
          onPress={
            ePaperOptimizations
              ? disableEPaperOptimizations
              : applyEPaperOptimizations
          }
        >
          <View style={styles.ePaperText}>
            <Text style={[styles.amoledLabel, { color: theme.onSurface }]}>
              {getString('appearanceScreen.ePaperApply')}
            </Text>
            <Text style={{ color: theme.onSurfaceVariant }}>
              {getString('onboardingScreen.ePaperOptimizationsDescription')}
            </Text>
          </View>
          <Switch
            value={ePaperOptimizations}
            onValueChange={
              ePaperOptimizations
                ? disableEPaperOptimizations
                : applyEPaperOptimizations
            }
          />
        </Pressable>
      )}
      {/* AMOLED Toggle */}
      <AmoledToggle theme={theme} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  segmentedControlContainer: {
    marginBottom: 24,
  },
  amoledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginTop: 'auto',
  },
  amoledLabel: {
    fontSize: 16,
    fontWeight: '400',
  },
  ePaperText: {
    flex: 1,
    paddingRight: 12,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
});
