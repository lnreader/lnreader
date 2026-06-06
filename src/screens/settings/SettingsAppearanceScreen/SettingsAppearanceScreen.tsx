import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Appearance,
  GestureResponderEvent,
} from 'react-native';

import { ThemePicker } from '@components/ThemePicker/ThemePicker';
import type { SegmentedControlOption } from '@components/SegmentedControl';
import SettingSwitch from '../components/SettingSwitch';
import ColorPickerModal from '@components/ColorPickerModal/ColorPickerModal';
import LanguagePickerModal from './LanguagePickerModal';

import { useAppSettings, useTheme } from '@hooks/persisted';
import {
  useMMKVBoolean,
  useMMKVNumber,
  useMMKVString,
} from 'react-native-mmkv';
import { Appbar, List, SafeAreaView, SegmentedControl } from '@components';
import { AppearanceSettingsScreenProps } from '@navigators/types';
import { getString } from '@strings/translations';
import { darkThemes, lightThemes } from '@theme/md3';
import { ThemeColors } from '@theme/types';
import switchTheme from 'react-native-theme-switch-animation';
import Color from 'color';

type ThemeMode = 'light' | 'dark' | 'system';

const AppearanceSettings = ({ navigation }: AppearanceSettingsScreenProps) => {
  const theme = useTheme();
  const [, setThemeId] = useMMKVNumber('APP_THEME_ID');
  const [themeMode = 'system', setThemeMode] = useMMKVString('THEME_MODE') as [
    ThemeMode,
    (mode: ThemeMode) => void,
  ];
  const [isAmoledBlack = false, setAmoledBlack] =
    useMMKVBoolean('AMOLED_BLACK');
  const [, setCustomAccentColor] = useMMKVString('CUSTOM_ACCENT_COLOR');

  const {
    showHistoryTab,
    showUpdatesTab,
    showLabelsInNav,
    hideBackdrop,
    useFabForContinueReading,
    setAppSettings,
  } = useAppSettings();

  const colorScheme = Appearance.getColorScheme() ?? 'light';
  const actualThemeMode: Exclude<ThemeMode, 'system'> =
    themeMode !== 'system'
      ? themeMode
      : colorScheme === 'unspecified'
      ? 'light'
      : colorScheme;

  /**
   * Accent Color Modal
   */
  const [accentColorModal, setAccentColorModal] = useState(false);
  const showAccentColorModal = () => setAccentColorModal(true);
  const hideAccentColorModal = () => setAccentColorModal(false);

  /**
   * Language Picker Modal
   */
  const [languageModal, setLanguageModal] = useState(false);
  const showLanguageModal = () => setLanguageModal(true);
  const hideLanguageModal = () => setLanguageModal(false);
  const [appLocale = ''] = useMMKVString('APP_LOCALE');

  const getCurrentLanguageName = (): string => {
    if (!appLocale) {
      return getString('appearanceScreen.appLanguageDefault');
    }
    const languageMap: Record<string, string> = {
      af: 'Afrikaans',
      ar: 'العربية',
      as: 'অসমীয়া',
      ca: 'Català',
      cs: 'Čeština',
      da: 'Dansk',
      de: 'Deutsch',
      el: 'Ελληνικά',
      en: 'English',
      es: 'Español',
      fi: 'Suomi',
      fr: 'Français',
      he: 'עברית',
      hi: 'हिन्दी',
      hu: 'Magyar',
      id: 'Bahasa Indonesia',
      it: 'Italiano',
      ja: '日本語',
      ko: '한국어',
      nl: 'Nederlands',
      no: 'Norsk',
      or: 'ଓଡ଼ିଆ',
      pl: 'Polski',
      pt: 'Português',
      'pt-BR': 'Português (Brasil)',
      ro: 'Română',
      ru: 'Русский',
      sq: 'Shqip',
      sr: 'Српски',
      sv: 'Svenska',
      tr: 'Türkçe',
      uk: 'Українська',
      vi: 'Tiếng Việt',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
    };
    return languageMap[appLocale] || appLocale;
  };

  const themeModeOptions: SegmentedControlOption<ThemeMode>[] = useMemo(
    () => [
      {
        value: 'system',
        label: getString('appearanceScreen.themeModeSystem'),
      },
      {
        value: 'light',
        label: getString('appearanceScreen.themeModeLight'),
      },
      {
        value: 'dark',
        label: getString('appearanceScreen.themeModeDark'),
      },
    ],
    [],
  );

  // const handleModeChange = (mode: ThemeMode) => {
  //   setThemeMode(mode);

  //   if (mode !== 'system') {
  //     const themes = mode === 'dark' ? darkThemes : lightThemes;
  //     const currentThemeInMode = themes.find(t => t.id === theme.id);

  //     if (!currentThemeInMode) {
  //       setThemeId(themes[0].id);
  //     }
  //   }
  // };

  // const handleThemeSelect = (selectedTheme: ThemeColors) => {
  //   setThemeId(selectedTheme.id);
  //   setCustomAccentColor(undefined);

  //   if (actualThemeMode !== 'system') {
  //     setThemeMode(selectedTheme.isDark ? 'dark' : 'light');
  //   }
  // };

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
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('appearance')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
      >
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('appearanceScreen.appTheme')}
          </List.SubHeader>

          {/* Theme Mode Selector */}
          <View style={styles.segmentedControlContainer}>
            <SegmentedControl
              options={themeModeOptions}
              value={themeMode}
              onChange={handleModeChange}
              theme={theme}
            />
          </View>

          {/* Light Themes */}
          {/*<Text style={[{ color: theme.onSurface }, styles.themeSectionText]}>
            {getString('appearanceScreen.lightTheme')}
          </Text>*/}
          <View style={styles.scrollViewContainer}>
            <ScrollView
              contentContainerStyle={[
                styles.themePickerRow,
                { backgroundColor: theme.surfaceVariant },
              ]}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
            >
              {(actualThemeMode === 'light' ? lightThemes : darkThemes).map(
                item => (
                  <ThemePicker
                    horizontal
                    key={item.id}
                    currentTheme={theme}
                    theme={item}
                    onPress={e => handleThemeSelect(item, e)}
                  />
                ),
              )}
            </ScrollView>
          </View>
          {theme.isDark ? (
            <SettingSwitch
              label={getString('appearanceScreen.pureBlackDarkMode')}
              value={isAmoledBlack}
              onPress={() => setAmoledBlack(prevVal => !prevVal)}
              theme={theme}
            />
          ) : null}
          <List.ColorItem
            title={getString('appearanceScreen.accentColor')}
            color={Color(theme.primary)}
            onPress={showAccentColorModal}
            theme={theme}
          />
          <List.Item
            title={getString('appearanceScreen.appLanguage')}
            description={getCurrentLanguageName()}
            onPress={showLanguageModal}
            theme={theme}
          />
          <List.Divider theme={theme} />
          <List.SubHeader theme={theme}>
            {getString('appearanceScreen.novelInfo')}
          </List.SubHeader>
          <SettingSwitch
            label={getString('appearanceScreen.hideBackdrop')}
            value={hideBackdrop}
            onPress={() => setAppSettings({ hideBackdrop: !hideBackdrop })}
            theme={theme}
          />
          <SettingSwitch
            label={getString('advancedSettingsScreen.useFAB')}
            value={useFabForContinueReading}
            onPress={() =>
              setAppSettings({
                useFabForContinueReading: !useFabForContinueReading,
              })
            }
            theme={theme}
          />
          <List.Divider theme={theme} />
          <List.SubHeader theme={theme}>
            {getString('appearanceScreen.navbar')}
          </List.SubHeader>
          <SettingSwitch
            label={getString('appearanceScreen.showUpdatesInTheNav')}
            value={showUpdatesTab}
            onPress={() => setAppSettings({ showUpdatesTab: !showUpdatesTab })}
            theme={theme}
          />
          <SettingSwitch
            label={getString('appearanceScreen.showHistoryInTheNav')}
            value={showHistoryTab}
            onPress={() => setAppSettings({ showHistoryTab: !showHistoryTab })}
            theme={theme}
          />
          <SettingSwitch
            label={getString('appearanceScreen.alwaysShowNavLabels')}
            value={showLabelsInNav}
            onPress={() =>
              setAppSettings({ showLabelsInNav: !showLabelsInNav })
            }
            theme={theme}
          />
        </List.Section>
      </ScrollView>

      <ColorPickerModal
        title={getString('appearanceScreen.accentColor')}
        visible={accentColorModal}
        closeModal={hideAccentColorModal}
        color={theme.primary}
        onSubmit={val => setCustomAccentColor(val)}
        theme={theme}
        showAccentColors={true}
      />
      <LanguagePickerModal
        visible={languageModal}
        onDismiss={hideLanguageModal}
      />
    </SafeAreaView>
  );
};

export default AppearanceSettings;

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  themeSectionText: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  themePickerRow: {
    borderRadius: 24,
    //marginHorizontal: 8,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollViewContainer: {
    paddingHorizontal: 8,
  },
  segmentedControlContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
