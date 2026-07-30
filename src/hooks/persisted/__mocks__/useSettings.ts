export const APP_SETTINGS = 'APP_SETTINGS';
export const BROWSE_SETTINGS = 'BROWSE_SETTINGS';
export const LIBRARY_SETTINGS = 'LIBRARY_SETTINGS';
export const CHAPTER_GENERAL_SETTINGS = 'CHAPTER_GENERAL_SETTINGS';
export const CHAPTER_READER_SETTINGS = 'CHAPTER_READER_SETTINGS';

export const initialAppSettings = {
  incognitoMode: false,
  disableHapticFeedback: false,
  showHistoryTab: true,
  showUpdatesTab: true,
  showLabelsInNav: true,
  useFabForContinueReading: false,
  disableLoadingAnimations: false,
  dateFormat: 'default',
  relativeTimestamps: true,
  downloadedOnlyMode: false,
  useLibraryFAB: false,
  smartUpdateSkipCompleted: false,
  smartUpdateSkipUnstarted: false,
  smartUpdateSkipWithUnread: false,
  automaticLibraryUpdateIntervalHours: 0,
  automaticBackupIntervalHours: 0,
  updateLibraryOnLaunch: false,
  downloadNewChapters: false,
  refreshNovelMetadata: false,
  hideBackdrop: false,
  defaultChapterSort: 'positionAsc',
};

export const initialBrowseSettings = {
  showMyAnimeList: true,
  showAniList: true,
  globalSearchConcurrency: 3,
};

export const defaultLibrarySettings = {
  defaultCategoryId: undefined,
  globalUpdateExcludeCategoryIds: [],
  globalUpdateIncludeCategoryIds: [],
  showNumberOfNovels: false,
  downloadedOnlyMode: false,
  incognitoMode: false,
  displayMode: 'comfortable',
  showDownloadBadges: true,
  showUnreadBadges: true,
  novelsPerRow: 3,
  sortOrder: 'DateAdded_DESC',
};

export const initialChapterGeneralSettings = {
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
};

export const initialChapterReaderSettings = {
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

export const useAppSettings = jest.fn(() => ({
  ...initialAppSettings,
  setAppSettings: jest.fn(),
}));

export const useBrowseSettings = jest.fn(() => ({
  ...initialBrowseSettings,
  setBrowseSettings: jest.fn(),
}));

export const useLibrarySettings = jest.fn(() => ({
  ...defaultLibrarySettings,
  setLibrarySettings: jest.fn(),
}));

export const useChapterGeneralSettings = jest.fn(() => ({
  ...initialChapterGeneralSettings,
  setChapterGeneralSettings: jest.fn(),
}));

export const useChapterReaderSettings = jest.fn(() => ({
  ...initialChapterReaderSettings,
  setChapterReaderSettings: jest.fn(),
  saveCustomReaderTheme: jest.fn(),
  deleteCustomReaderTheme: jest.fn(),
}));

export default {
  useAppSettings,
  useBrowseSettings,
  useLibrarySettings,
  useChapterGeneralSettings,
  useChapterReaderSettings,
};
