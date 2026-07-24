// require('react-native-gesture-handler/jestSetup');
// require('react-native-reanimated').setUpTests();

jest.mock('@modules/native-file', () => ({
  __esModule: true,
  default: {
    writeFile: jest.fn(),
    readFile: jest.fn(() => ''),
    copyFile: jest.fn(),
    moveFile: jest.fn(),
    exists: jest.fn(() => true),
    mkdir: jest.fn(),
    unlink: jest.fn(),
    readDir: jest.fn(() => []),
    downloadFile: jest.fn().mockResolvedValue(),
    getConstants: jest.fn(() => ({
      ExternalDirectoryPath: '/mock/external',
      ExternalCachesDirectoryPath: '/mock/caches',
    })),
  },
}));

const mockEpubNovel = {
  name: 'Mock Novel',
  cover: null,
  summary: null,
  author: null,
  artist: null,
  chapters: [],
  cssPaths: [],
  imagePaths: [],
};

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => ({
      parseNovelAndChapters: jest.fn(() => mockEpubNovel),
    })),
  },
}));

jest.mock('@modules/native-tts-media-control', () => ({
  __esModule: true,
  default: {
    showMediaNotification: jest.fn(),
    updatePlaybackState: jest.fn(),
    updateProgress: jest.fn(),
    dismiss: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

jest.mock('@modules/native-volume-button-listener', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
    setActive: jest.fn(),
  },
}));

jest.mock('@modules/native-zip-archive', () => ({
  __esModule: true,
  default: {
    zip: jest.fn().mockResolvedValue(),
    unzip: jest.fn().mockResolvedValue(),
    remoteUnzip: jest.fn().mockResolvedValue(),
    remoteZip: jest.fn().mockResolvedValue(''),
  },
}));
