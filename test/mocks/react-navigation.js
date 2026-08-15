const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();

// Patch react-native-worklets mock so reanimated setup doesn't crash.
// Reanimated v4.5.2 imports createShareable, UIRuntimeId, getUIRuntimeHolder,
// getUISchedulerHolder, toggleSlowAnimationsOnUIRuntime from worklets,
// but the shipped mock (src/mock.ts) doesn't export them.
jest.mock('react-native-worklets', () => {
  const mockWorklets = jest.requireActual('react-native-worklets/src/mock');
  return {
    __esModule: true,
    ...mockWorklets,
    getUIRuntimeHolder: () => ({}),
    getUISchedulerHolder: () => ({}),
    createShareable: (_hostRuntimeId, initial) => initial,
    UIRuntimeId: 2,
    toggleSlowAnimationsOnUIRuntime: (_enabled) => { },
  };
});

// Include this line for mocking react-native-gesture-handler
require('react-native-gesture-handler/jestSetup');

// Include this section for mocking react-native-reanimated
try {
  const { setUpTests } = require('react-native-reanimated');
  setUpTests();
} catch (e) {
  // swallow — reanimated setup may fail in some environments
}

jest.mock('@react-navigation/native', () => {
  return {
    useFocusEffect: jest.fn(),
    useNavigation: () => ({
      navigate: mockNavigate,
      setOptions: mockSetOptions,
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

module.exports = { mockNavigate, mockSetOptions };
