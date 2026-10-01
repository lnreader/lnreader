import { useState, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuItem,
  Spacer,
} from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import { getString } from '@i18n/translations';
import { useTheme } from '@hooks/persisted/useTheme';
import CheckBoxIcon from '@expo/material-symbols/check_box.xml';
import CheckBoxOutlineBlankIcon from '@expo/material-symbols/check_box_outline_blank.xml';
import MoreVertIcon from '@expo/material-symbols/more_vert.xml';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';
import IconButtonV2 from '../IconButtonV2/IconButtonV2';

export interface MenuAction {
  label: string;
  onPress: () => void;
  icon?: IconSource;
  disabled?: boolean;
  checked?: boolean;
  destructive?: boolean;
}

export type IconAction = MenuAction & { icon: IconSource };

interface MenuItemsProps {
  actions: readonly MenuAction[];
  onClose: () => void;
}

export const MenuItems = ({ actions, onClose }: MenuItemsProps) => {
  const theme = useTheme();
  // Keep labels aligned: once one item has an icon, all get an icon slot.
  const withIcons = actions.some(action => action.icon);
  return (
    <>
      {actions.map(action => (
        <DropdownMenuItem
          key={action.label}
          enabled={!action.disabled}
          onClick={() => {
            onClose();
            action.onPress();
          }}
          elementColors={{
            textColor: action.destructive ? theme.error : theme.onSurface,
            leadingIconColor: theme.onSurfaceVariant,
            trailingIconColor: theme.onSurfaceVariant,
            disabledTextColor: theme.onSurfaceDisabled,
          }}
        >
          <DropdownMenuItem.Text>
            <AppText
              variant="bodyLarge"
              color={action.destructive ? theme.error : theme.onSurface}
            >
              {action.label}
            </AppText>
          </DropdownMenuItem.Text>
          {withIcons ? (
            <DropdownMenuItem.LeadingIcon>
              {action.icon ? (
                <AppIcon source={action.icon} />
              ) : (
                <Spacer modifiers={[size(24, 24)]} />
              )}
            </DropdownMenuItem.LeadingIcon>
          ) : null}
          {action.checked !== undefined ? (
            <DropdownMenuItem.TrailingIcon>
              <AppIcon
                source={
                  action.checked ? CheckBoxIcon : CheckBoxOutlineBlankIcon
                }
                tint={action.checked ? theme.primary : undefined}
              />
            </DropdownMenuItem.TrailingIcon>
          ) : null}
        </DropdownMenuItem>
      ))}
    </>
  );
};

interface OverflowMenuProps {
  actions: readonly MenuAction[];
  icon?: IconSource;
  label?: string;
  renderTrigger?: (open: () => void) => ReactNode;
}

export const OverflowMenu = ({
  actions,
  icon = MoreVertIcon,
  label = getString('common.moreOptions'),
  renderTrigger,
}: OverflowMenuProps) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const open = () => setExpanded(true);

  return (
    <DropdownMenu
      expanded={expanded}
      onDismissRequest={() => setExpanded(false)}
      color={theme.surfaceContainer}
    >
      <DropdownMenu.Trigger>
        {renderTrigger ? (
          renderTrigger(open)
        ) : (
          <IconButtonV2
            name={icon}
            accessibilityLabel={label}
            onPress={open}
            theme={theme}
          />
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <MenuItems actions={actions} onClose={() => setExpanded(false)} />
      </DropdownMenu.Items>
    </DropdownMenu>
  );
};

interface MenuProps {
  visible: boolean;
  onDismiss: () => void;
  anchor: ReactNode;
  children: ReactNode;
}

interface MenuItemProps {
  title: string;
  onPress: () => void;
}

const MenuItem = ({ title, onPress }: MenuItemProps) => {
  const theme = useTheme();
  return (
    <DropdownMenuItem
      onClick={onPress}
      elementColors={{ textColor: theme.onSurface }}
    >
      <DropdownMenuItem.Text>
        <AppText variant="bodyLarge">{title}</AppText>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>
  );
};

const Menu = ({ visible, onDismiss, anchor, children }: MenuProps) => {
  const theme = useTheme();
  return (
    <DropdownMenu
      expanded={visible}
      onDismissRequest={onDismiss}
      color={theme.surfaceContainer}
    >
      <DropdownMenu.Trigger>{anchor}</DropdownMenu.Trigger>
      <DropdownMenu.Items>{children}</DropdownMenu.Items>
    </DropdownMenu>
  );
};

Menu.Item = MenuItem;

export default Menu;
