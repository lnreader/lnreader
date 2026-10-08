import React from 'react';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import OutlinedBox from '../OutlinedBox/OutlinedBox';
import List from '../List/List';
import { type IconSource } from '../AppIcon/AppIcon';

export const ColorSwatch = ({
  color,
  diameter = 28,
  selected,
  onPress,
  theme,
}: {
  color: string;
  diameter?: number;
  selected?: boolean;
  onPress?: () => void;
  theme: ThemeColors;
}) => {
  return (
    <OutlinedBox
      shape="circle"
      outlineWidth={selected ? 3 : 1}
      outlineColor={selected ? theme.primary : theme.outline}
      color={color}
      onPress={onPress}
      modifiers={[size(diameter, diameter)]}
    />
  );
};

interface ColorPreferenceItemProps {
  label: string;
  icon?: IconSource;
  description?: string;
  onPress: () => void;
  theme: ThemeColors;
}

const ColorPreferenceItem: React.FC<ColorPreferenceItemProps> = ({
  label,
  icon,
  description,
  onPress,
  theme,
}) => (
  <List.Item
    title={label}
    icon={icon}
    description={description?.toUpperCase?.()}
    onPress={onPress}
    theme={theme}
    trailing={
      description ? (
        <ColorSwatch color={description} theme={theme} />
      ) : undefined
    }
  />
);

export default ColorPreferenceItem;
