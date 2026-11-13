import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Appearance, Alert } from 'react-native';

import { ThemePicker } from '@components/ThemePicker/ThemePicker';
import type { SegmentedControlOption } from '@components/SegmentedControl';
import SettingSwitch from '../components/SettingSwitch';
import ColorPickerModal from '@components/ColorPickerModal/ColorPickerModal';
import LanguagePickerModal from './LanguagePickerModal';
import DateFormatModal from './DateFormatModal';

import { useAppSettings, useTheme } from '@hooks/persisted';
import { useEPaperOptimizations } from '@hooks/persisted/useEPaperOptimizations';
import {
  useMMKVBoolean,
  useMMKVNumber,
  useMMKVString,
} from 'react-native-mmkv';
import { Appbar, List, SafeAreaView, SegmentedControl } from '@components';
import { AppearanceSettingsScreenProps } from '@navigators/types';
import { getString } from '@i18n/translations';
import { darkThemes, lightThemes, E_PAPER_THEME_ID } from '@theme/md3';
import {
  DYNAMIC_THEME_ID,
  getSystemDynamicTheme,
  isDynamicThemeAvailable,
  toDynamicThemeColors,
} from '@theme/dynamic';
import { ThemeColors } from '@theme/types';
import Color from 'color';
import { formatDate, getDateFormatLabel } from '@utils/dateFormat';

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
    dateFormat = 'default',
    relativeTimestamps = true,
    setAppSettings,
  } = useAppSettings();
  const {
    ePaperOptimizations,
    applyEPaperOptimizations,
    disableEPaperOptimizations,
  } = useEPaperOptimizations();

  const colorScheme = Appearance.getColorScheme() ?? 'light';
  const actualThemeMode: Exclude<ThemeMode, 'system'> =
    themeMode !== 'system'
      ? themeMode
      : colorScheme === 'unspecified'
      ? 'light'
      : colorScheme;
  const availableThemes = useMemo(() => {
    const themes = actualThemeMode === 'light' ? lightThemes : darkThemes;
    if (!isDynamicThemeAvailable) {
      return themes;
    }

    const dynamicTheme =
      theme.id === DYNAMIC_THEME_ID
        ? theme
        : toDynamicThemeColors(
            getSystemDynamicTheme(),
            actualThemeMode === 'dark',
          );
    return [dynamicTheme, ...themes];
  }, [actualThemeMode, theme]);

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

  const [dateFormatModal, setDateFormatModal] = useState(false);
  const showDateFormatModal = () => setDateFormatModal(true);
  const hideDateFormatModal = () => setDateFormatModal(false);

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

  const handleModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const selectTheme = (selectedTheme: ThemeColors) => {
    setThemeId(selectedTheme.id);
    setCustomAccentColor(undefined);
  };

  const handleThemeSelect = (selectedTheme: ThemeColors) => {
    if (selectedTheme.id === E_PAPER_THEME_ID) {
      selectTheme(selectedTheme);
      if (!ePaperOptimizations) {
        Alert.alert(
          getString('appearanceScreen.ePaperApplyTitle'),
          getString('appearanceScreen.ePaperApplyDescription'),
          [
            { text: getString('appearanceScreen.ePaperThemeOnly') },
            {
              text: getString('appearanceScreen.ePaperApply'),
              onPress: applyEPaperOptimizations,
            },
          ],
        );
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
            onPress: () => selectTheme(selectedTheme),
          },
          {
            text: getString('appearanceScreen.ePaperRestore'),
            onPress: () => {
              disableEPaperOptimizations();
              selectTheme(selectedTheme);
            },
          },
        ],
      );
      return;
    }

    selectTheme(selectedTheme);
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

          <View style={styles.scrollViewContainer}>
            <ScrollView
              contentContainerStyle={styles.themePickerRow}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
            >
              {availableThemes.map(item => (
                <ThemePicker
                  horizontal
                  key={item.id}
                  currentTheme={theme}
                  theme={item}
                  onPress={() => handleThemeSelect(item)}
                />
              ))}
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
          {theme.id === DYNAMIC_THEME_ID ? null : (
            <List.ColorItem
              title={getString('appearanceScreen.accentColor')}
              color={Color(theme.primary)}
              onPress={showAccentColorModal}
              theme={theme}
            />
          )}
          <List.SubHeader theme={theme}>
            {getString('common.display')}
          </List.SubHeader>
          <List.Item
            title={getString('appearanceScreen.appLanguage')}
            description={getCurrentLanguageName()}
            onPress={showLanguageModal}
            theme={theme}
          />
          <List.Item
            title={getString('appearanceScreen.dateFormat')}
            description={getDateFormatLabel(dateFormat)}
            onPress={showDateFormatModal}
            theme={theme}
          />
          <SettingSwitch
            label={getString('appearanceScreen.relativeTimestamps')}
            description={getString(
              'appearanceScreen.relativeTimestampsDescription',
              {
                date: formatDate(new Date(), dateFormat, false),
              },
            )}
            value={relativeTimestamps}
            onPress={() =>
              setAppSettings({
                relativeTimestamps: !relativeTimestamps,
              })
            }
            theme={theme}
          />
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
      <DateFormatModal
        visible={dateFormatModal}
        onDismiss={hideDateFormatModal}
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
  themePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scrollViewContainer: {
    marginVertical: 24,
    paddingHorizontal: 16,
  },
  segmentedControlContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
