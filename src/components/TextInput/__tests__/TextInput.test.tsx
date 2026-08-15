jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  const View = RN.View || require('react-native').View;
  return {
    TextInput: RN.TextInput,
    GestureHandlerRootView: View,
    Swipeable: View,
    Pressable: RN.Pressable || View,
    State: { BEGAN: 0, ACTIVE: 1, END: 2 },
    PanGestureHandler: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    LongPressGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    FlingGestureHandler: View,
    Directions: { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8 },
    gestureHandlerRootHOC: (c: unknown) => c,
    createNativeWrapper: (c: unknown) => c,
    // Default export used by some imports
    default: {
      TextInput: RN.TextInput,
      GestureHandlerRootView: View,
    },
  };
});

import './mocks';
import { render, screen, fireEvent } from '@testing-library/react-native';
import TextInput from '../index';

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

const mockTheme = {
  primary: '#6200ee',
  onSurface: '#000',
  onSurfaceVariant: '#666',
  surfaceVariant: '#e8e8e8',
  rippleColor: 'rgba(0,0,0,0.1)',
  outline: '#ccc',
  error: '#f00',
  background: '#fff',
  surface: '#f5f5f5',
  onPrimary: '#fff',
  onBackground: '#000',
};

describe('TextInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue(mockTheme);
  });

  it('renders with placeholder', () => {
    render(<TextInput placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('on focus: border color changes to theme.primary, border width 2', () => {
    render(<TextInput placeholder="Test" />);
    const input = screen.getByPlaceholderText('Test');

    fireEvent(input, 'focus');

    // The style array contains the dynamic style object as first element
    const styleArray = input.props.style;
    expect(styleArray[0].borderColor).toBe(mockTheme.primary);
    expect(styleArray[0].borderWidth).toBe(2);
  });

  it('on blur: border color reverts to theme.outline, border width 1', () => {
    render(<TextInput placeholder="Test" />);
    const input = screen.getByPlaceholderText('Test');

    fireEvent(input, 'focus');
    fireEvent(input, 'blur');

    const styleArray = input.props.style;
    expect(styleArray[0].borderColor).toBe(mockTheme.outline);
    expect(styleArray[0].borderWidth).toBe(1);
  });

  it('error state: border color is theme.error, border width 2 regardless of focus', () => {
    render(<TextInput placeholder="Test" error />);
    const input = screen.getByPlaceholderText('Test');

    const styleArray = input.props.style;
    expect(styleArray[0].borderColor).toBe(mockTheme.error);
    expect(styleArray[0].borderWidth).toBe(2);

    // Blur should not change error styling
    fireEvent(input, 'blur');
    expect(styleArray[0].borderColor).toBe(mockTheme.error);
    expect(styleArray[0].borderWidth).toBe(2);
  });

  it('forceFocused prop: shows focused styling even without actual focus', () => {
    render(<TextInput placeholder="Test" forceFocused />);
    const input = screen.getByPlaceholderText('Test');

    const styleArray = input.props.style;
    expect(styleArray[0].borderColor).toBe(mockTheme.primary);
    expect(styleArray[0].borderWidth).toBe(2);

    // Blur should not change forceFocused styling
    fireEvent(input, 'blur');
    expect(styleArray[0].borderColor).toBe(mockTheme.primary);
  });

  it('merges custom style prop with default styles', () => {
    render(<TextInput placeholder="Test" style={{ fontSize: 20 }} />);
    const input = screen.getByPlaceholderText('Test');

    const styleArray = input.props.style;
    // Default textInput style (index 1) should have inherited styles
    // Custom style is last (index 2)
    expect(styleArray[2]).toEqual({ fontSize: 20 });
  });

  it('passes through other TextInput props (onChangeText)', () => {
    const onChangeText = jest.fn();
    render(<TextInput placeholder="Test" onChangeText={onChangeText} />);
    const input = screen.getByPlaceholderText('Test');

    fireEvent.changeText(input, 'new text');
    expect(onChangeText).toHaveBeenCalledWith('new text');
  });
});
