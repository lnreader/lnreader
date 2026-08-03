import { render, screen } from '@testing-library/react-native';

import { Checkbox } from '../Checkbox/Checkbox';
import type { ThemeColors } from '../../theme/types';

const mockTheme = {
  onSurface: '#111111',
  onSurfaceDisabled: '#777777',
  onSurfaceVariant: '#555555',
  primary: '#6200ee',
  onPrimary: '#ffffff',
  rippleColor: '#eeeeee',
} as ThemeColors;

describe('Checkbox', () => {
  it('renders an accessible description below the label', () => {
    render(
      <Checkbox
        description="Include app preferences"
        label="Settings"
        onPress={() => {}}
        status
        theme={mockTheme}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Settings' });

    expect(checkbox.props.accessibilityState).toEqual({
      checked: true,
      disabled: undefined,
    });
    expect(checkbox.props.accessibilityHint).toBe('Include app preferences');
    expect(screen.getByText('Include app preferences')).toBeOnTheScreen();
  });

  it('centers the checkbox against the label and description block', () => {
    render(
      <Checkbox
        description="Include app preferences"
        label="Settings"
        status={false}
        theme={mockTheme}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Settings' })).toHaveStyle({
      alignItems: 'center',
      flexDirection: 'row',
    });
  });

  it('maps the indeterminate status onto the Compose tri-state checkbox', () => {
    render(
      <Checkbox label="Select all" status="indeterminate" theme={mockTheme} />,
    );

    const composeCheckbox = screen.getByTestId('tri-state-checkbox');
    expect(composeCheckbox.props.accessibilityState.checked).toBe('mixed');
    expect(composeCheckbox.props.colors).toMatchObject({
      checkedColor: mockTheme.primary,
      checkmarkColor: mockTheme.onPrimary,
    });
  });

  it('disables the Compose checkbox when disabled', () => {
    render(
      <Checkbox label="Settings" status={false} disabled theme={mockTheme} />,
    );

    expect(
      screen.getByTestId('tri-state-checkbox').props.accessibilityState
        .disabled,
    ).toBe(true);
  });
});
