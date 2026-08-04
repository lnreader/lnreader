import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

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

const SelectableChip: React.FC<SelectableChipProps> = ({
  label,
  selected,
  theme,
  onPress,
  icon,
  showCheckIcon = true,
  customFontFamily,
  mode = 'flat',
}) => {
  return (
    <Chip
      selected={selected}
      onPress={onPress}
      icon={icon}
      showSelectedCheck={showCheckIcon}
      style={styles.chip}
      textStyle={{ fontFamily: customFontFamily }}
      theme={{ colors: theme }}
      mode={selected ? 'flat' : mode}
    >
      {label}
    </Chip>
  );
};

export default SelectableChip;

const styles = StyleSheet.create({
  chip: {
    marginHorizontal: 6,
  },
});
