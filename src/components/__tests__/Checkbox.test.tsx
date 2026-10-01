import { render, screen } from '@testing-library/react-native';

import { Checkbox } from '../Checkbox/Checkbox';
import type { ThemeColors } from '../../theme/types';

const mockTheme = {
  onSurface: '#111111',
  onSurfaceDisabled: '#777777',
  onSurfaceVariant: '#555555',
  primary: '#6200ee',
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
    expect(screen.getByText('Include app preferences')).toBeOnTheScreen();
  });
});
