jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@i18n/translations', () => ({
  getString: jest.fn(key => key),
}));

jest.mock('@utils/parseChapterNumber', () => ({
  parseChapterNumber: jest.fn(() => 1),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/mock/storage',
}));

jest.mock('@hooks/persisted/usePlugins');
jest.mock('@hooks/persisted/useTracker');
jest.mock('@hooks/persisted/useDownload');
jest.mock('@hooks/persisted/useUserAgent');
jest.mock('@hooks/persisted/useSettings');

jest.mock('@hooks/persisted/useNovelSettings');
jest.mock('@hooks/persisted/useHistory');
jest.mock('@hooks/persisted/useImport');
jest.mock('@hooks/persisted/useSelfHost');
jest.mock('@hooks/persisted/useTheme');
jest.mock('@hooks/persisted/useTrackedNovel');
jest.mock('@hooks/persisted/useUpdates');
jest.mock('@services/plugin/fetch');
jest.mock('@components/Context/LibraryContext');
