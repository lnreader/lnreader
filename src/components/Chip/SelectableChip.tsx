import React from 'react';
import { FilterChip } from '@expo/ui/jetpack-compose';

import {
  ExpoHost,
  getFilterChipBorder,
  getFilterChipColors,
} from '@components/ExpoUI';
import { ThemeColors } from '../../theme/types';

interface SelectableChipProps {
  label: string;
  selected: boolean;
  theme: ThemeColors;
  onPress: () => void;
  icon?: string;
  showCheckIcon?: boolean;
  customFontFamily?: string;
  mode?: 'flat' | 'outlined';
}

/**
 * `icon` isn't used anywhere in the app today, and Expo UI's Chip icon slots
 * require an XML vector-drawable/image source rather than an arbitrary
 * MaterialCommunityIcons glyph name, so it's accepted but not rendered here.
 * Material 3's FilterChip already outlines itself when unselected and fills
 * with a container color when selected, so `mode` no longer needs to switch
 * between flat/outlined explicitly.
 */
const SelectableChip: React.FC<SelectableChipProps> = ({
  label,
  selected,
  theme,
  onPress,
}) => {
  return (
    <ExpoHost theme={theme} matchContents>
      <FilterChip
        selected={selected}
        onClick={onPress}
        colors={getFilterChipColors(theme)}
        border={getFilterChipBorder(theme)}
      >
        <FilterChip.Label>{label}</FilterChip.Label>
      </FilterChip>
    </ExpoHost>
  );
};

export default SelectableChip;
