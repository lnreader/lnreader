// Mock for react-native-nitro-modules in Jest environment
jest.mock('react-native-nitro-modules', () => ({
  __esModule: true,
  default: {
    createHybridObject: jest.fn(() => {
      // Return a mock object that won't be used since MMKV has its own mock
      return {};
    }),
  },
}));
