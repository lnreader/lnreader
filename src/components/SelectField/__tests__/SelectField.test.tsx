import { render, screen, fireEvent } from '@testing-library/react-native';

import { SelectField } from '../SelectField';
import type { ThemeColors } from '@theme/types';

const mockTheme = {
  primary: 'rgb(0, 87, 206)',
  onSurface: 'rgb(27, 27, 31)',
  onSurfaceVariant: 'rgb(68, 70, 79)',
  outline: 'rgb(117, 119, 128)',
} as ThemeColors;

const options = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
];

describe('SelectField', () => {
  it('displays the label matching the current value', () => {
    render(
      <SelectField
        label="Language"
        value="en"
        options={options}
        onValueChange={() => {}}
        theme={mockTheme}
      />,
    );

    expect(screen.getByText('English')).toBeOnTheScreen();
  });

  it('opens the menu when the field is tapped and lists every option', () => {
    render(
      <SelectField
        label="Language"
        value="en"
        options={options}
        onValueChange={() => {}}
        theme={mockTheme}
      />,
    );

    expect(screen.queryByTestId('exposed-dropdown-menu')).toBeNull();

    fireEvent.press(screen.getByTestId('exposed-dropdown-menu-box'));

    expect(screen.getByTestId('exposed-dropdown-menu')).toBeOnTheScreen();
    expect(screen.getByText('French')).toBeOnTheScreen();
  });

  it('calls onValueChange with the selected option and closes the menu', () => {
    const onValueChange = jest.fn();
    render(
      <SelectField
        label="Language"
        value="en"
        options={options}
        onValueChange={onValueChange}
        theme={mockTheme}
      />,
    );

    fireEvent.press(screen.getByTestId('exposed-dropdown-menu-box'));
    fireEvent.press(screen.getAllByTestId('dropdown-menu-item')[1]);

    expect(onValueChange).toHaveBeenCalledWith('fr');
    expect(screen.queryByTestId('exposed-dropdown-menu')).toBeNull();
  });

  it('updates the displayed label when the selected value changes', () => {
    const { rerender } = render(
      <SelectField
        label="Language"
        value="en"
        options={options}
        onValueChange={() => {}}
        theme={mockTheme}
      />,
    );

    expect(screen.getByText('English')).toBeOnTheScreen();

    rerender(
      <SelectField
        label="Language"
        value="fr"
        options={options}
        onValueChange={() => {}}
        theme={mockTheme}
      />,
    );

    expect(screen.getByText('French')).toBeOnTheScreen();
    expect(screen.queryByText('English')).toBeNull();
  });
});
