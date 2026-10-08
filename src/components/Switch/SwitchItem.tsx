import { ListItem } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, toggleable } from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import Switch from './Switch';
import { Leading, listItemColors, Texts } from '../List/List';
import { type IconSource } from '../AppIcon/AppIcon';

interface SwitchItemProps {
  value: boolean;
  label: string;
  description?: string | null;
  icon?: IconSource;
  disabled?: boolean;
  onPress: () => void;
  theme: ThemeColors;
}

const SwitchItem = ({
  label,
  description,
  icon,
  disabled,
  value,
  onPress,
  theme,
}: SwitchItemProps) => {
  return (
    <ListItem
      colors={listItemColors(theme)}
      modifiers={[
        fillMaxWidth(),
        toggleable(value, () => !disabled && onPress(), { role: 'switch' }),
      ]}
    >
      <Leading icon={icon} />
      <Texts
        title={label}
        description={description}
        disabled={disabled}
        theme={theme}
      />
      <ListItem.TrailingContent>
        <Switch value={value} disabled={disabled} onValueChange={onPress} />
      </ListItem.TrailingContent>
    </ListItem>
  );
};

export default SwitchItem;
