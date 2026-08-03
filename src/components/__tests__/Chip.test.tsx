import { render, screen, fireEvent } from '@testing-library/react-native';

import Chip from '../Chip/Chip';
import SelectableChip from '../Chip/SelectableChip';
import type { ThemeColors } from '@theme/types';

const mockTheme = {
  secondaryContainer: 'rgb(220, 226, 249)',
  onSecondaryContainer: 'rgb(21, 27, 44)',
  onSurfaceVariant: 'rgb(68, 70, 79)',
  outline: 'rgb(117, 119, 128)',
} as ThemeColors;

describe('Chip', () => {
  it('renders the label via the AssistChip label slot', () => {
    render(<Chip label="Ongoing" theme={mockTheme} />);

    expect(screen.getByText('Ongoing')).toBeOnTheScreen();
  });

  it('maps secondaryContainer/onSecondaryContainer onto the chip', () => {
    render(<Chip label="Ongoing" theme={mockTheme} />);

    expect(screen.getByTestId('assist-chip').props.colors).toEqual({
      containerColor: mockTheme.secondaryContainer,
      labelColor: mockTheme.onSecondaryContainer,
    });
  });
});

describe('SelectableChip', () => {
  it('renders the label and reflects the selected state', () => {
    render(
      <SelectableChip
        label="Fantasy"
        selected
        theme={mockTheme}
        onPress={() => {}}
      />,
    );

    expect(screen.getByText('Fantasy')).toBeOnTheScreen();
    expect(screen.getByTestId('filter-chip').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <SelectableChip
        label="Fantasy"
        selected={false}
        theme={mockTheme}
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByTestId('filter-chip'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('maps selected/unselected colors and an outline border', () => {
    render(
      <SelectableChip
        label="Fantasy"
        selected={false}
        theme={mockTheme}
        onPress={() => {}}
      />,
    );

    const chip = screen.getByTestId('filter-chip');
    expect(chip.props.colors).toEqual({
      containerColor: 'transparent',
      labelColor: mockTheme.onSurfaceVariant,
      selectedContainerColor: mockTheme.secondaryContainer,
      selectedLabelColor: mockTheme.onSecondaryContainer,
    });
    expect(chip.props.border).toEqual({ width: 1, color: mockTheme.outline });
  });
});
