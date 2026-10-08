import {
  Box,
  ListItem,
  TriStateCheckbox as ComposeTriStateCheckbox,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  size,
  toggleable,
} from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import ArrowDownwardIcon from '@expo/material-symbols/arrow_downward.xml';
import ArrowUpwardIcon from '@expo/material-symbols/arrow_upward.xml';
import AppIcon from '../AppIcon/AppIcon';
import { listItemColors, Texts } from '../List/List';

interface CheckboxProps {
  label: string;
  status: boolean | 'indeterminate';
  onPress?: () => void;
  disabled?: boolean;
  description?: string;
  theme: ThemeColors;
}

export const Checkbox = ({
  label,
  status,
  disabled,
  onPress,
  description,
  theme,
}: CheckboxProps) => {
  const press = () => !disabled && onPress?.();
  return (
    <ListItem
      colors={listItemColors(theme)}
      modifiers={[
        fillMaxWidth(),
        toggleable(status === true, press, { role: 'checkbox' }),
      ]}
    >
      <ListItem.LeadingContent>
        <ComposeTriStateCheckbox
          state={
            status === 'indeterminate' ? 'indeterminate' : status ? 'on' : 'off'
          }
          enabled={!disabled}
          onClick={press}
          colors={{
            checkedColor: theme.primary,
            uncheckedColor: theme.onSurfaceVariant,
            checkmarkColor: theme.onPrimary,
            disabledCheckedColor: theme.onSurfaceDisabled,
            disabledUncheckedColor: theme.onSurfaceDisabled,
            disabledIndeterminateColor: theme.onSurfaceDisabled,
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

interface SortItemProps {
  label: string;
  status?: string;
  onPress: () => void;
  theme: ThemeColors;
}

export const SortItem = ({ label, status, onPress, theme }: SortItemProps) => {
  return (
    <ListItem
      colors={listItemColors(theme)}
      modifiers={[fillMaxWidth(), clickable(onPress)]}
    >
      <ListItem.LeadingContent>
        <Box modifiers={[size(24, 24)]}>
          {status ? (
            <AppIcon
              source={status === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon}
              tint={theme.primary}
            />
          ) : null}
        </Box>
      </ListItem.LeadingContent>
      <Texts title={label} theme={theme} />
    </ListItem>
  );
};
