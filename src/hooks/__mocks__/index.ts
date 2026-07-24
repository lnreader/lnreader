// Mock utilities
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
  NOVEL_STORAGE: {},
}));

// Mock MMKVStorage
jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

// Mock NativeFile
jest.mock('@modules/native-file', () => ({
  // Mock NativeFile methods
}));

// Mock dayjs
jest.mock('dayjs', () =>
  jest.fn(() => ({
    format: jest.fn(() => '2023-01-01'),
  })),
);
