import './mocks';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ToggleButton } from '../ToggleButton';

// Mock native icon module
jest.mock('@react-native-vector-icons/material-design-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIcon = (props: Record<string, unknown>) =>
    React.createElement(View, { ...props, testID: 'icon' });
  MockIcon.displayName = 'MaterialCommunityIcons';
  return { __esModule: true, default: MockIcon };
});

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

describe('ToggleButton', () => {
  it('renders icon via MaterialCommunityIcons', () => {
    render(
      <ToggleButton icon="cog" selected={false} theme={mockTheme} onPress={() => { }} />,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('selected state: icon color is theme.primary', () => {
    render(
      <ToggleButton icon="cog" selected={true} theme={mockTheme} onPress={() => { }} />,
    );
    const icon = screen.getByTestId('icon');
    expect(icon.props.color).toBe(mockTheme.primary);
  });

  it('unselected state: icon color is theme.onSurface', () => {
    render(
      <ToggleButton icon="cog" selected={false} theme={mockTheme} onPress={() => { }} />,
    );
    const icon = screen.getByTestId('icon');
    expect(icon.props.color).toBe(mockTheme.onSurface);
  });

  it('calls onPress on press', () => {
    const onPress = jest.fn();
    render(
      <ToggleButton icon="cog" selected={false} theme={mockTheme} onPress={onPress} />,
    );
    fireEvent.press(screen.getByTestId('icon'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: press does not call onPress', () => {
    const onPress = jest.fn();
    render(
      <ToggleButton icon="cog" selected={false} theme={mockTheme} onPress={onPress} disabled={true} />,
    );

    fireEvent.press(screen.getByTestId('icon'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
