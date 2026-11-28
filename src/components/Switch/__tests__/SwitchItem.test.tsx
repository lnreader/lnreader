import './mocks';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SwitchItem from '../SwitchItem';

// Mock reanimated — setUpTests in global setup may have failed.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    useDerivedValue: (fn: () => unknown) => fn(),
    withTiming: (val: unknown) => val,
    withSpring: (val: unknown) => val,
    interpolateColor: () => 'transparent',
    createAnimatedComponent: (c: unknown) => c,
    default: { View },
    __esModule: true,
  };
});

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

const mockTheme = {
  id: 0,
  name: 'test',
  isDark: false,
  primary: '#6200ee',
  onPrimary: '#fff',
  primaryContainer: '#e8def8',
  onPrimaryContainer: '#21005d',
  secondary: '#625b71',
  onSecondary: '#fff',
  secondaryContainer: '#e8def8',
  onSecondaryContainer: '#1d192b',
  tertiary: '#7d5260',
  onTertiary: '#fff',
  tertiaryContainer: '#ffd8e4',
  onTertiaryContainer: '#31111d',
  error: '#f00',
  onError: '#fff',
  errorContainer: '#f9dedc',
  onErrorContainer: '#410e0b',
  background: '#fff',
  onBackground: '#000',
  surface: '#f5f5f5',
  onSurface: '#000',
  surfaceVariant: '#e8e8e8',
  onSurfaceVariant: '#666',
  outline: '#ccc',
  outlineVariant: '#cac4d0',
  shadow: '#000',
  scrim: '#000',
  inverseSurface: '#313033',
  inverseOnSurface: '#f4eff4',
  inversePrimary: '#d0bcff',
  surfaceDisabled: 'rgba(28, 27, 31, 0.12)',
  onSurfaceDisabled: 'rgba(28, 27, 31, 0.38)',
  backdrop: 'rgba(0, 0, 0, 0.4)',
  rippleColor: 'rgba(0,0,0,0.1)',
};

describe('SwitchItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue(mockTheme);
  });

  it('renders label text', () => {
    render(
      <SwitchItem
        label="Test Label"
        value={false}
        onPress={() => {}}
        theme={mockTheme}
      />,
    );
    expect(screen.getByText('Test Label')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(
      <SwitchItem
        label="Test"
        description="A helpful description"
        value={false}
        onPress={() => {}}
        theme={mockTheme}
      />,
    );
    expect(screen.getByText('A helpful description')).toBeTruthy();
  });

  it('does not render description when omitted', () => {
    render(
      <SwitchItem
        label="Test"
        value={false}
        onPress={() => {}}
        theme={mockTheme}
      />,
    );
    expect(screen.queryByText('A helpful description')).toBeNull();
  });

  it('calls onPress on press', () => {
    const onPress = jest.fn();
    render(
      <SwitchItem
        label="Pressable"
        value={false}
        onPress={onPress}
        theme={mockTheme}
      />,
    );
    fireEvent.press(screen.getByText('Pressable'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onLongPress on long press', () => {
    const onLongPress = jest.fn();
    render(
      <SwitchItem
        label="Long Press"
        value={false}
        onPress={() => {}}
        onLongPress={onLongPress}
        theme={mockTheme}
      />,
    );
    fireEvent(screen.getByText('Long Press'), 'onLongPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('has correct accessibility role and label', () => {
    render(
      <SwitchItem
        label="Accessible"
        value={false}
        onPress={() => {}}
        theme={mockTheme}
      />,
    );
    const element = screen.getByRole('switch', { name: 'Accessible' });
    expect(element).toBeTruthy();
  });
});
