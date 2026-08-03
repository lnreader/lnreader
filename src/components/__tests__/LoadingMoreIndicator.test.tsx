import { render, screen } from '@testing-library/react-native';
import LoadingMoreIndicator from '../LoadingMoreIndicator/LoadingMoreIndicator';
import { ThemeColors } from '../../theme/types';

const mockTheme: ThemeColors = {
  id: 1,
  name: 'Light',
  isDark: false,
  primary: '#6200ee',
  onPrimary: '#ffffff',
  primaryContainer: '#ffffff',
  onPrimaryContainer: '#000000',
  secondary: '#6200ee',
  onSecondary: '#ffffff',
  secondaryContainer: '#ffffff',
  onSecondaryContainer: '#000000',
  tertiary: '#6200ee',
  onTertiary: '#ffffff',
  tertiaryContainer: '#ffffff',
  onTertiaryContainer: '#000000',
  error: '#ff0000',
  onError: '#ffffff',
  errorContainer: '#ffeeee',
  onErrorContainer: '#ff0000',
  background: '#ffffff',
  onBackground: '#000000',
  surface: '#ffffff',
  onSurface: '#000000',
  surfaceVariant: '#f5f5f5',
  onSurfaceVariant: '#666666',
  outline: '#cccccc',
  outlineVariant: '#eeeeee',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#333333',
  inverseOnSurface: '#ffffff',
  inversePrimary: '#bb86fc',
  surfaceDisabled: '#eeeeee',
  onSurfaceDisabled: '#999999',
  backdrop: 'rgba(0,0,0,0.5)',
};

describe('LoadingMoreIndicator', () => {
  it('renders ActivityIndicator with theme color', () => {
    const { toJSON } = render(<LoadingMoreIndicator theme={mockTheme} />);

    expect(toJSON()).toBeTruthy();
  });

  it('passes the theme primary color to the Compose progress indicator', () => {
    const customTheme = { ...mockTheme, primary: '#ff0000' };
    render(<LoadingMoreIndicator theme={customTheme} />);

    expect(screen.getByTestId('circular-progress-indicator').props.color).toBe(
      '#ff0000',
    );
  });
});
