import {
  ListItem,
  RadioButton as ComposeRadioButton,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, selectable } from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import { listItemColors, Texts } from '../List/List';

interface Props {
  label: string;
  status: boolean;
  onPress?: () => void;
  description?: string;
  disabled?: boolean;
  theme: ThemeColors;
}

export const RadioButton = ({
  label,
  status,
  onPress,
  description,
  disabled,
  theme,
}: Props) => {
  const press = () => !disabled && onPress?.();
  return (
    <ListItem
      colors={listItemColors(theme)}
      modifiers={[fillMaxWidth(), selectable(status, press, 'radioButton')]}
    >
      <ListItem.LeadingContent>
        <ComposeRadioButton
          selected={status}
          enabled={!disabled}
          onClick={press}
          colors={{
            selectedColor: theme.primary,
            unselectedColor: theme.onSurfaceVariant,
            disabledSelectedColor: theme.onSurfaceDisabled,
            disabledUnselectedColor: theme.onSurfaceDisabled,
          }}
        />
      </ListItem.LeadingContent>
      <Texts
        title={label}
        description={description}
        disabled={disabled}
        theme={theme}
      />
    </ListItem>
  );
};
