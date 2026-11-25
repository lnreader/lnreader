// require('react-native-gesture-handler/jestSetup');
// require('react-native-reanimated').setUpTests();

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getApiLevel: jest.fn().mockResolvedValue(35),
    getBrand: jest.fn(() => 'mock-brand'),
    getBuildId: jest.fn().mockResolvedValue('mock-build-id'),
    getBuildNumber: jest.fn(() => '1'),
    getBundleId: jest.fn(() => 'com.lnreader'),
    getDeviceId: jest.fn(() => 'mock-device'),
    getManufacturer: jest.fn().mockResolvedValue('mock-manufacturer'),
    getModel: jest.fn(() => 'mock-model'),
    getSystemName: jest.fn(() => 'Android'),
    getSystemVersion: jest.fn(() => '15'),
    supportedAbis: jest.fn().mockResolvedValue([]),
  },
  getBatteryLevel: jest.fn().mockResolvedValue(1),
  getBatteryLevelSync: jest.fn(() => 1),
  getUserAgentSync: jest.fn(() => 'LNReader test'),
  useBatteryLevel: jest.fn(() => 1),
}));

jest.mock('@modules/native-file', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/mock/documents',
    ExternalDirectoryPath: '/mock/external',
    ExternalCachesDirectoryPath: '/mock/caches',
    writeFile: jest.fn(),
    readFile: jest.fn(() => ''),
    fileSize: jest.fn(() => Promise.resolve(0)),
    copyFile: jest.fn(),
    copyFileToDirectory: jest.fn(() =>
      Promise.resolve({ uri: '/mock/export.epub', size: 1 }),
    ),
    pickDirectory: jest.fn(() =>
      Promise.resolve({ uri: '/mock/export', name: 'export' }),
    ),
    moveFile: jest.fn(),
    exists: jest.fn(() => true),
    mkdir: jest.fn(),
    unlink: jest.fn(),
    readDir: jest.fn(() => []),
    downloadFile: jest.fn().mockResolvedValue(),
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

global.mockEpubNovel = mockEpubNovel;

jest.mock('@modules/native-volume-button-listener', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
    setActive: jest.fn(),
  },
}));

jest.mock('@modules/native-share-receiver', () => ({
  __esModule: true,
  default: {
    getInitialSharedText: jest.fn(async () => null),
    takeOpenedEpubs: jest.fn(async () => []),
    stageOpenedEpub: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
  },
}));

jest.mock('@modules/native-widgets', () => ({
  __esModule: true,
  default: {
    hasWidgets: jest.fn().mockResolvedValue(false),
    setSnapshot: jest.fn().mockResolvedValue(),
    setLibraryUpdateState: jest.fn().mockResolvedValue(),
  },
}));

jest.mock('@modules/native-zip-archive', () => ({
  __esModule: true,
  default: {
    zip: jest.fn().mockResolvedValue(),
    unzip: jest.fn().mockResolvedValue(),
    readEntry: jest.fn().mockResolvedValue(null),
    openArchive: jest.fn().mockResolvedValue(1),
    closeArchive: jest.fn().mockResolvedValue(),
    archiveEntryExists: jest.fn().mockResolvedValue(false),
    archiveEntrySize: jest.fn().mockResolvedValue(0),
    readArchiveDir: jest.fn().mockResolvedValue([]),
    readArchiveFile: jest.fn().mockResolvedValue(''),
    extractArchiveFile: jest.fn().mockResolvedValue(),
    remoteUnzip: jest.fn().mockResolvedValue(),
    remoteZip: jest.fn().mockResolvedValue(''),
  },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPreviousSignIn: jest.fn().mockResolvedValue(false),
    getCurrentUser: jest.fn().mockResolvedValue(null),
    signIn: jest.fn().mockResolvedValue(null),
    signOut: jest.fn().mockResolvedValue(null),
    getTokens: jest.fn().mockResolvedValue({ accessToken: '' }),
  },
}));

jest.mock('@react-native-community/netinfo', () => {
  const fetch = jest
    .fn()
    .mockResolvedValue({ isConnected: true, type: 'wifi' });
  const addEventListener = jest.fn(() => jest.fn());
  const useNetInfo = jest
    .fn()
    .mockReturnValue({ isConnected: true, type: 'wifi' });
  return {
    __esModule: true,
    fetch,
    addEventListener,
    useNetInfo,
    default: {
      fetch,
      addEventListener,
      useNetInfo,
    },
  };
});
