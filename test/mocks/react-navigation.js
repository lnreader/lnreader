const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockNavigationRef = {
  isReady: jest.fn(() => true),
  navigate: mockNavigate,
  getCurrentRoute: jest.fn(() => null),
};

jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);

// Reanimated 4.7 uses its JS fallback module under Jest but still runs the
// native initializer, which registers a CSS event handler that the fallback
// throws for. Make that one call a no-op before Reanimated is first loaded.
// The package entry resolves to lib/module while its Jest mock imports src.
for (const entry of ['lib/module', 'src']) {
  require(
    `react-native-reanimated/${entry}/ReanimatedModule`,
  ).ReanimatedModule.setCSSEventHandler = () => {};
}

// The worklets UI run loop defines this on device; its Jest mock doesn't, but
// Reanimated's native mapper registry schedules itself with it. A no-op keeps
// that self-rescheduling loop from spinning on timers between tests.
globalThis.requestAnimationFrameFinalizer = () => {};

// Reanimated 4.7's native components look up a host view on mount, which the
// test renderer doesn't provide, so use the mock Reanimated ships for Jest.
jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);

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
    createNavigationContainerRef: () => mockNavigationRef,
  };
});

module.exports = { mockNavigate, mockSetOptions, mockNavigationRef };
