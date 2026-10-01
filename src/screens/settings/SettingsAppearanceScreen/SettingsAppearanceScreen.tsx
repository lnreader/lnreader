import { useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { LazyRow } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { ThemePicker } from '@components/ThemePicker/ThemePicker';
import type { SegmentedControlOption } from '@components/SegmentedControl';
import ColorPickerModal from '@components/ColorPickerModal/ColorPickerModal';
import LanguagePickerModal from './LanguagePickerModal';
import DateFormatModal from './DateFormatModal';

import { useAppSettings, useTheme } from '@hooks/persisted';
import {
  useMMKVBoolean,
  useMMKVNumber,
  useMMKVString,
} from 'react-native-mmkv';
import { List, SegmentedControl, SwitchItem } from '@components';
import SettingsPage from '../components/SettingsPage';
import { AppearanceSettingsScreenProps } from '@navigators/types';
import { getString } from '@i18n/translations';
import { darkThemes, lightThemes } from '@theme/md3';
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

  const handleThemeSelect = (selectedTheme: ThemeColors) => {
    setThemeId(selectedTheme.id);
    setCustomAccentColor(undefined);
  };

  return (
    <SettingsPage
      title={getString('appearance')}
      onBack={navigation.goBack}
      overlays={
        <>
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
        </>
      }
    >
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('appearanceScreen.appTheme')}
        </List.SubHeader>

        <SegmentedControl
          options={themeModeOptions}
          value={themeMode}
          onChange={handleModeChange}
          modifiers={[fillMaxWidth(), padding(16, 12, 16, 0)]}
          theme={theme}
        />

        <LazyRow
          horizontalArrangement={{ spacedBy: 12 }}
          contentPadding={{ start: 16, end: 16, top: 24, bottom: 24 }}
          modifiers={[fillMaxWidth()]}
        >
          {availableThemes.map(item => (
            <ThemePicker
              key={item.id}
              currentTheme={theme}
              theme={item}
              onPress={() => handleThemeSelect(item)}
            />
          ))}
        </LazyRow>
        {theme.isDark ? (
          <SwitchItem
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
        <SwitchItem
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
        <SwitchItem
          label={getString('appearanceScreen.hideBackdrop')}
          value={hideBackdrop}
          onPress={() => setAppSettings({ hideBackdrop: !hideBackdrop })}
          theme={theme}
        />
        <SwitchItem
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
        <SwitchItem
          label={getString('appearanceScreen.showUpdatesInTheNav')}
          value={showUpdatesTab}
          onPress={() => setAppSettings({ showUpdatesTab: !showUpdatesTab })}
          theme={theme}
        />
        <SwitchItem
          label={getString('appearanceScreen.showHistoryInTheNav')}
          value={showHistoryTab}
          onPress={() => setAppSettings({ showHistoryTab: !showHistoryTab })}
          theme={theme}
        />
        <SwitchItem
          label={getString('appearanceScreen.alwaysShowNavLabels')}
          value={showLabelsInNav}
          onPress={() => setAppSettings({ showLabelsInNav: !showLabelsInNav })}
          theme={theme}
        />
      </List.Section>
    </SettingsPage>
  );
};

export default AppearanceSettings;
