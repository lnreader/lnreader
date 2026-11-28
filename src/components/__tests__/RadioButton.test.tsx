import { fireEvent, render, screen } from '@testing-library/react-native';

import { RadioButton } from '../RadioButton/RadioButton';
import type { ThemeColors } from '../../theme/types';

const mockTheme = {
  onSurface: '#111111',
  onSurfaceVariant: '#555555',
  primary: '#6200ee',
  rippleColor: '#eeeeee',
} as ThemeColors;

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
