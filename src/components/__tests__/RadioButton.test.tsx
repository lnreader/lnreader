import './mocks';
import { fireEvent, render, screen } from '@test-utils';

import { RadioButton } from '@components/RadioButton/RadioButton';
import type { ThemeColors } from '@theme/types';

const mockTheme = {
  onSurface: '#111111',
  onSurfaceVariant: '#555555',
  primary: '#6200ee',
  rippleColor: '#eeeeee',
} as ThemeColors;

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = jest.requireActual('react-native');
  const frame = { height: 800, width: 400, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };
  return {
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) =>
      ReactModule.createElement(View, props, children),
    initialWindowMetrics: { frame, insets },
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});

describe('RadioButton', () => {
  it('exposes the selected state on the whole row', () => {
    render(<RadioButton label="Reading" status theme={mockTheme} />);

    expect(
      screen.getByRole('radio', { name: 'Reading' }).props.accessibilityState,
    ).toEqual({ checked: true });
    expect(
      screen.getByTestId('radio-selected', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('selects when the label is pressed', () => {
    const onPress = jest.fn();
    render(
      <RadioButton
        label="Completed"
        status={false}
        onPress={onPress}
        theme={mockTheme}
      />,
    );

    fireEvent.press(screen.getByText('Completed'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
