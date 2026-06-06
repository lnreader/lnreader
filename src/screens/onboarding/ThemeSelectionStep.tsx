import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  GestureResponderEvent,
} from 'react-native';
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
import { darkThemes, lightThemes } from '@theme/md3';
import { getString } from '@strings/translations';
import { LegendList } from '@legendapp/list';
import Switch from '@components/Switch/Switch';
import switchTheme from 'react-native-theme-switch-animation';

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

  const currentMode = themeMode as ThemeMode;

  const availableThemes = useMemo(() => {
    return theme.isDark ? darkThemes : lightThemes;
  }, [theme.isDark]);

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

  const handleModeChange = (mode: ThemeMode, event: GestureResponderEvent) => {
    setTimeout(() => setThemeMode(mode), 0);
    event.currentTarget.measure((_x1, _y1, width, height, px, py) => {
      switchTheme({
        switchThemeFunction: () => {},
        animationConfig: {
          type: 'circular',
          duration: 400,
          startingPoint: {
            cy: py + height / 2,
            cx: px + width / 2,
          },
        },
      });
    });
  };

  const handleThemeSelect = (
    selectedTheme: ThemeColors,
    event: GestureResponderEvent,
  ) => {
    setThemeId(selectedTheme.id);
    event.currentTarget.measure((_x1, _y1, width, height, px, py) => {
      switchTheme({
        switchThemeFunction: () => {},
        animationConfig: {
          type: 'circular',
          duration: 400,
          startingPoint: {
            cy: py + height / 2,
            cx: px + width / 2,
          },
        },
      });
    });
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
        extraData={theme}
        keyExtractor={item => 'theme-' + item.id}
        renderItem={({ item }) => (
          <View>
            <ThemePicker
              currentTheme={theme}
              theme={item}
              onPress={e => handleThemeSelect(item, e)}
            />
          </View>
        )}
      />
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
