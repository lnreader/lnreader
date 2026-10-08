import React from 'react';
import { FilterChip } from '@expo/ui/jetpack-compose';

import { ThemeColors } from '../../theme/types';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';
import CheckIcon from '@expo/material-symbols/check.xml';

interface SelectableChipProps {
  label: string;
  selected: boolean;
  theme: ThemeColors;
  onPress: () => void;
  icon?: IconSource;
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
  const leadingIcon = selected && showCheckIcon ? CheckIcon : icon;
  return (
    <FilterChip
      selected={selected}
      onClick={onPress}
      colors={{
        containerColor:
          mode === 'outlined' ? 'transparent' : theme.surfaceContainerLow,
        labelColor: theme.onSurfaceVariant,
        iconColor: theme.onSurfaceVariant,
        selectedContainerColor: theme.secondaryContainer,
        selectedLabelColor: theme.onSecondaryContainer,
        selectedLeadingIconColor: theme.onSecondaryContainer,
      }}
      border={
        selected || mode === 'flat'
          ? { width: 0 }
          : { color: theme.outlineVariant }
      }
    >
      <FilterChip.Label>
        <AppText
          variant="labelLarge"
          style={
            customFontFamily ? { fontFamily: customFontFamily } : undefined
          }
        >
          {label}
        </AppText>
      </FilterChip.Label>
      {leadingIcon ? (
        <FilterChip.LeadingIcon>
          <AppIcon source={leadingIcon} size={18} />
        </FilterChip.LeadingIcon>
      ) : null}
    </FilterChip>
  );
};

export default SelectableChip;
