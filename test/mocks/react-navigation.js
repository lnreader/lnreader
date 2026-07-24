const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);

// Include this line for mocking react-native-gesture-handler
require('react-native-gesture-handler/jestSetup');

// Include this section for mocking react-native-reanimated
const { setUpTests } = require('react-native-reanimated');

setUpTests();

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
