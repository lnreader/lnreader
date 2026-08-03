import { render, screen, fireEvent } from '@testing-library/react-native';

import Switch from '../Switch/Switch';

const mockTheme = {
  primary: 'rgb(0, 87, 206)',
  onPrimary: 'rgb(255, 255, 255)',
  surfaceVariant: 'rgb(225, 226, 236)',
  outline: 'rgb(117, 119, 128)',
  surfaceDisabled: 'rgba(27, 27, 31, 0.12)',
  onSurfaceDisabled: 'rgba(27, 27, 31, 0.38)',
};

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockTheme,
}));

describe('Switch', () => {
  it('reflects the checked state on the Compose switch', () => {
    render(<Switch value={true} onValueChange={() => {}} />);

    expect(
      screen.getByTestId('compose-switch').props.accessibilityState,
    ).toEqual({ checked: true });
  });

  it('maps theme colors onto the Compose switch', () => {
    render(<Switch value={true} onValueChange={() => {}} />);

    expect(screen.getByTestId('compose-switch').props.colors).toMatchObject({
      checkedTrackColor: mockTheme.primary,
      checkedThumbColor: mockTheme.onPrimary,
      uncheckedTrackColor: mockTheme.surfaceVariant,
      uncheckedThumbColor: mockTheme.outline,
    });
  });

  it('toggles via the wrapping Pressable', () => {
    const onValueChange = jest.fn();
    render(<Switch value={false} onValueChange={onValueChange} />);

    fireEvent.press(screen.getByTestId('switch'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });
});
