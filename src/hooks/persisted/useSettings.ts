import { ChapterOrderKey } from '@database/constants';
import {
  DisplayModes,
  LibraryFilter,
  LibrarySortOrder,
} from '@screens/library/constants/constants';
import { Voice } from 'expo-speech';
import { useMMKVObject } from 'react-native-mmkv';
import { getMMKVObject, getSecureKey, SecureMMKVStorage } from '@utils/mmkv/mmkv';



export const APP_SETTINGS = 'APP_SETTINGS';
export const BROWSE_SETTINGS = 'BROWSE_SETTINGS';
export const LIBRARY_SETTINGS = 'LIBRARY_SETTINGS';
export const CHAPTER_GENERAL_SETTINGS = 'CHAPTER_GENERAL_SETTINGS';
export const CHAPTER_READER_SETTINGS = 'CHAPTER_READER_SETTINGS';

export interface AppSettings {
  /**
   * General settings
   */

  incognitoMode: boolean;
  disableHapticFeedback: boolean;

  /**
   * Appearence settings
   */

  showHistoryTab: boolean;
  showUpdatesTab: boolean;
  showLabelsInNav: boolean;
  useFabForContinueReading: boolean;
  disableLoadingAnimations: boolean;

  /**
   * Library settings
   */

  downloadedOnlyMode: boolean;
  useLibraryFAB: boolean;

  /**
   * Update settings
   */

  onlyUpdateOngoingNovels: boolean;
  updateLibraryOnLaunch: boolean;
  downloadNewChapters: boolean;
  refreshNovelMetadata: boolean;

  /**
   * Novel settings
   */

  hideBackdrop: boolean;
  defaultChapterSort: ChapterOrderKey;
}

export interface BrowseSettings {
  showMyAnimeList: boolean;
  showAniList: boolean;
  globalSearchConcurrency?: number;
}

export interface LibrarySettings {
  sortOrder?: LibrarySortOrder;
  filter?: LibraryFilter;
  showDownloadBadges?: boolean;
  showUnreadBadges?: boolean;
  showNumberOfNovels?: boolean;
  displayMode?: DisplayModes;
  novelsPerRow?: number;
  incognitoMode?: boolean;
  downloadedOnlyMode?: boolean;
}

export type TranslationConfig =
  | {
      provider: 'gtx';
    }
  | {
      provider: 'google';
    }
  | {
      provider: 'deepl';
      plan: 'free' | 'pro';
    }
  | {
      provider: 'microsoft';
      region: string;
    };

export interface ChapterGeneralSettings {
  keepScreenOn: boolean;
  fullScreenMode: boolean;
  pageReader: boolean;
  swipeGestures: boolean;
  showScrollPercentage: boolean;
  useVolumeButtons: boolean;
  volumeButtonsOffset: number | null;
  showBatteryAndTime: boolean;
  autoScroll: boolean;
  autoScrollInterval: number;
  autoScrollOffset: number | null;
  verticalSeekbar: boolean;
  removeExtraParagraphSpacing: boolean;
  bionicReading: boolean;
  tapToScroll: boolean;
  TTSEnable: boolean;
  translationTargetLang: string;
  translationConfig: TranslationConfig;
}

export interface ReaderTheme {
  backgroundColor: string;
  textColor: string;
}

export interface ChapterReaderSettings {
  theme: string;
  textColor: string;
  textSize: number;
  textAlign: string;
  padding: number;
  fontFamily: string;
  lineHeight: number;
  customCSS: string;
  customJS: string;
  customThemes: ReaderTheme[];
  tts?: {
    voice?: Voice;
    rate?: number;
    pitch?: number;
    autoPageAdvance?: boolean;
    scrollToTop?: boolean;
  };
  epubLocation: string;
  epubUseAppTheme: boolean;
  epubUseCustomCSS: boolean;
  epubUseCustomJS: boolean;
}

const initialAppSettings: AppSettings = {
  /**
   * General settings
   */

  incognitoMode: false,
  disableHapticFeedback: false,

  /**
   * Appearence settings
   */

  showHistoryTab: true,
  showUpdatesTab: true,
  showLabelsInNav: true,
  useFabForContinueReading: false,
  disableLoadingAnimations: false,

  /**
   * Library settings
   */

  downloadedOnlyMode: false,
  useLibraryFAB: false,

  /**
   * Update settings
   */

  onlyUpdateOngoingNovels: false,
  updateLibraryOnLaunch: false,
  downloadNewChapters: false,
  refreshNovelMetadata: false,

  /**
   * Novel settings
   */

  hideBackdrop: false,
  defaultChapterSort: 'positionAsc',
};

const initialBrowseSettings: BrowseSettings = {
  showMyAnimeList: true,
  showAniList: true,
  globalSearchConcurrency: 3,
};

export const initialChapterGeneralSettings: ChapterGeneralSettings = {
  keepScreenOn: true,
  fullScreenMode: true,
  pageReader: false,
  swipeGestures: false,
  showScrollPercentage: true,
  useVolumeButtons: false,
  volumeButtonsOffset: null,
  showBatteryAndTime: false,
  autoScroll: false,
  autoScrollInterval: 10,
  autoScrollOffset: null,
  verticalSeekbar: true,
  removeExtraParagraphSpacing: false,
  bionicReading: false,
  tapToScroll: false,
  TTSEnable: true,
  translationTargetLang: 'en',
  translationConfig: {
    provider: 'gtx',
  },
};

export const initialChapterReaderSettings: ChapterReaderSettings = {
  theme: '#292832',
  textColor: '#CCCCCC',
  textSize: 16,
  textAlign: 'left',
  padding: 16,
  fontFamily: '',
  lineHeight: 1.5,
  customCSS: '',
  customJS: '',
  customThemes: [],
  tts: {
    rate: 1,
    pitch: 1,
    autoPageAdvance: false,
    scrollToTop: true,
  },
  epubLocation: '',
  epubUseAppTheme: false,
  epubUseCustomCSS: false,
  epubUseCustomJS: false,
};

export const useAppSettings = () => {
  const [appSettings = initialAppSettings, setSettings] =
    useMMKVObject<AppSettings>(APP_SETTINGS);

  const setAppSettings = (values: Partial<AppSettings>) =>
    setSettings({ ...appSettings, ...values });

  return {
    ...appSettings,
    setAppSettings,
  };
};

export const useBrowseSettings = () => {
  const [browseSettings = initialBrowseSettings, setSettings] =
    useMMKVObject<BrowseSettings>(BROWSE_SETTINGS);

  const setBrowseSettings = (values: Partial<BrowseSettings>) =>
    setSettings({ ...browseSettings, ...values });

  return {
    ...browseSettings,
    setBrowseSettings,
  };
};

const defaultLibrarySettings: LibrarySettings = {
  showNumberOfNovels: false,
  downloadedOnlyMode: false,
  incognitoMode: false,
  displayMode: DisplayModes.Comfortable,
  showDownloadBadges: true,
  showUnreadBadges: true,
  novelsPerRow: 3,
  sortOrder: LibrarySortOrder.DateAdded_DESC,
};

export const useLibrarySettings = () => {
  const [librarySettings, setSettings] =
    useMMKVObject<LibrarySettings>(LIBRARY_SETTINGS);

  const setLibrarySettings = (value: Partial<LibrarySettings>) =>
    setSettings({ ...librarySettings, ...value });

  return {
    ...{ ...defaultLibrarySettings, ...librarySettings },
    setLibrarySettings,
  };
};

export const useChapterGeneralSettings = () => {
  const [storedSettings = initialChapterGeneralSettings, setSettings] =
    useMMKVObject<any>(CHAPTER_GENERAL_SETTINGS);

  const settings = { ...initialChapterGeneralSettings, ...storedSettings };

  const setChapterGeneralSettings = (values: Partial<ChapterGeneralSettings>) =>
    setSettings({ ...settings, ...values });

  return {
    ...(settings as ChapterGeneralSettings),
    setChapterGeneralSettings,
  };
};

export function getTranslationConfigAndKeys() {
  const settings = getMMKVObject<any>(CHAPTER_GENERAL_SETTINGS) || {};
  let translationConfig = settings.translationConfig;
  let provider = translationConfig?.provider || 'gtx';

  if ('translationProvider' in settings) {
    const oldProvider = settings.translationProvider || 'gtx';
    if (oldProvider === 'deepl') {
      translationConfig = {
        provider: 'deepl',
        plan: settings.deeplPlan || 'free',
      };
    } else if (oldProvider === 'microsoft') {
      translationConfig = {
        provider: 'microsoft',
        region: settings.microsoftRegion || '',
      };
    } else {
      translationConfig = {
        provider: oldProvider,
      };
    }
    provider = oldProvider;
  }

  const googleApiKey = getSecureKey('googleApiKey') || settings.googleApiKey || '';
  const deeplApiKey = getSecureKey('deeplApiKey') || settings.deeplApiKey || '';
  const microsoftApiKey = getSecureKey('microsoftApiKey') || settings.microsoftApiKey || '';

  const deeplPlan = (translationConfig?.provider === 'deepl' ? translationConfig.plan : undefined) || settings.deeplPlan || 'free';
  const microsoftRegion = (translationConfig?.provider === 'microsoft' ? translationConfig.region : undefined) || settings.microsoftRegion || '';

  return {
    provider,
    config: {
      googleApiKey,
      deeplApiKey,
      deeplPlan,
      microsoftApiKey,
      microsoftRegion,
    },
  };
}

export const useChapterReaderSettings = () => {
  const [storedSettings = initialChapterReaderSettings, setSettings] =
    useMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS);

  // Ensure TTS settings have proper defaults (migration for existing users)
  const chapterReaderSettings = {
    ...storedSettings,
    tts: {
      ...initialChapterReaderSettings.tts,
      ...storedSettings.tts,
      // Explicitly ensure these defaults if undefined
      autoPageAdvance: storedSettings.tts?.autoPageAdvance ?? false,
      scrollToTop: storedSettings.tts?.scrollToTop ?? true,
      rate: storedSettings.tts?.rate ?? 1,
      pitch: storedSettings.tts?.pitch ?? 1,
    },
  };

  const setChapterReaderSettings = (values: Partial<ChapterReaderSettings>) =>
    setSettings({ ...chapterReaderSettings, ...values });

  const saveCustomReaderTheme = (theme: ReaderTheme) =>
    setSettings({
      ...chapterReaderSettings,
      customThemes: [theme, ...chapterReaderSettings.customThemes],
    });

  const deleteCustomReaderTheme = (theme: ReaderTheme) =>
    setSettings({
      ...chapterReaderSettings,
      customThemes: chapterReaderSettings.customThemes.filter(
        v =>
          !(
            v.backgroundColor === theme.backgroundColor &&
            v.textColor === theme.textColor
          ),
      ),
    });

  return {
    ...chapterReaderSettings,
    setChapterReaderSettings,
    saveCustomReaderTheme,
    deleteCustomReaderTheme,
  };
};
