import React from 'react';
import { Box } from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import Color from 'color';
import { ThemeColors } from '../../theme/types';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import OutlinedBox from '../OutlinedBox/OutlinedBox';
import CheckIcon from '@expo/material-symbols/check.xml';
import FormatColorTextIcon from '@expo/material-symbols/format_color_text.xml';

interface ToggleButtonProps {
  icon: IconSource;
  selected: boolean;
  theme: ThemeColors;
  color?: string;
  onPress: () => void;
  disabled?: boolean;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  icon,
  selected,
  theme,
  color,
  onPress,
  disabled,
}) => (
  <Box
    contentAlignment="center"
    modifiers={[
      size(44, 44),
      clip(Shapes.RoundedCorner(8)),
      background(
        selected ? Color(theme.primary).alpha(0.12).string() : 'transparent',
      ),
      ...(disabled ? [] : [clickable(onPress)]),
    ]}
  >
    <AppIcon
      source={icon}
      tint={selected ? theme.primary : color ? color : theme.onSurface}
    />
  </Box>
);

interface ToggleColorButtonProps {
  selected: boolean;
  backgroundColor: string;
  textColor: string;
  theme: ThemeColors;
  onPress: () => void;
}

export const ToggleColorButton: React.FC<ToggleColorButtonProps> = ({
  selected,
  backgroundColor,
  textColor,
  theme,
  onPress,
}) => (
  <OutlinedBox
    shape="circle"
    outlineWidth={selected ? 3 : 1}
    outlineColor={selected ? theme.primary : theme.outlineVariant}
    color={backgroundColor}
    onPress={onPress}
    contentAlignment="center"
    modifiers={[size(48, 48)]}
  >
    <AppIcon
      source={selected ? CheckIcon : FormatColorTextIcon}
      tint={textColor}
    />
  </OutlinedBox>
);
