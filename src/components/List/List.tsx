import { type ReactNode } from 'react';
import {
  Column,
  HorizontalDivider,
  ListItem,
  Row,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import type { ColorInstance } from 'color';
import { ThemeColors } from '../../theme/types';
import OutlinedBox from '../OutlinedBox/OutlinedBox';
import InfoIcon from '@expo/material-symbols/info.xml';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';
import { listItemColors } from './listItemColors';

export interface RowBaseProps {
  title: string;
  description?: string | null;
  icon?: IconSource;
  disabled?: boolean;
  theme: ThemeColors;
}

export const Leading = ({ icon }: { icon?: IconSource }) =>
  icon ? (
    <ListItem.LeadingContent>
      <AppIcon source={icon} />
    </ListItem.LeadingContent>
  ) : null;

export const Texts = ({
  title,
  description,
  disabled,
  theme,
}: Pick<RowBaseProps, 'title' | 'description' | 'disabled' | 'theme'>) => {
  return (
    <>
      <ListItem.HeadlineContent>
        <AppText
          variant="bodyLarge"
          color={disabled ? theme.onSurfaceDisabled : theme.onSurface}
        >
          {title}
        </AppText>
      </ListItem.HeadlineContent>
      {description ? (
        <ListItem.SupportingContent>
          <AppText
            variant="bodyMedium"
            color={disabled ? theme.onSurfaceDisabled : theme.onSurfaceVariant}
          >
            {description}
          </AppText>
        </ListItem.SupportingContent>
      ) : null}
    </>
  );
};

const Section = ({ children }: { children: ReactNode }) => (
  <Column modifiers={[fillMaxWidth()]}>{children}</Column>
);

const SubHeader = ({
  children,
  theme,
}: {
  children: ReactNode;
  theme: ThemeColors;
}) => {
  return (
    <AppText
      variant="labelLarge"
      color={theme.primary}
      modifiers={[padding(16, 20, 16, 4)]}
    >
      {children}
    </AppText>
  );
};

const Divider = ({ theme }: { theme: ThemeColors }) => {
  return (
    <HorizontalDivider
      color={theme.outlineVariant}
      modifiers={[padding(16, 4, 16, 4)]}
    />
  );
};

interface ListItemProps extends RowBaseProps {
  onPress?: () => void;
  /** An icon, or text such as the current value. */
  right?: IconSource | string;
  trailing?: ReactNode;
}

const Item = ({
  title,
  description,
  icon,
  disabled,
  onPress,
  right,
  trailing,
  theme,
}: ListItemProps) => {
  const end =
    trailing ??
    (right === undefined || typeof right === 'string' ? (
      right
    ) : (
      <AppIcon source={right} tint={theme.primary} />
    ));
  return (
    <ListItem
      colors={listItemColors(theme)}
      modifiers={
        onPress && !disabled
          ? [fillMaxWidth(), clickable(onPress)]
          : [fillMaxWidth()]
      }
    >
      <Leading icon={icon} />
      <Texts
        title={title}
        description={description}
        disabled={disabled}
        theme={theme}
      />
      {end !== undefined ? (
        <ListItem.TrailingContent>
          {typeof end === 'string' ? (
            <AppText variant="labelLarge" color={theme.onSurfaceVariant}>
              {end}
            </AppText>
          ) : (
            end
          )}
        </ListItem.TrailingContent>
      ) : null}
    </ListItem>
  );
};

const InfoItem = ({ title, theme }: { title: string; theme: ThemeColors }) => {
  return (
    <Row
      verticalAlignment="top"
      modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}
    >
      <AppIcon source={InfoIcon} size={20} tint={theme.onSurfaceVariant} />
      <AppText
        variant="bodySmall"
        color={theme.onSurfaceVariant}
        modifiers={[padding(12, 0, 0, 0)]}
      >
        {title}
      </AppText>
    </Row>
  );
};

const Icon = ({ icon, theme }: { icon: IconSource; theme: ThemeColors }) => (
  <AppIcon source={icon} tint={theme.primary} />
);

interface ColorItemProps {
  title: string;
  color: ColorInstance;
  theme: ThemeColors;
  onPress: () => void;
}

const ColorItem = ({ title, color, theme, onPress }: ColorItemProps) => {
  return (
    <Item
      theme={theme}
      title={title}
      description={color.rgb().toString().toUpperCase()}
      onPress={onPress}
      trailing={
        <OutlinedBox
          shape="circle"
          outlineWidth={1}
          outlineColor={theme.outline}
          color={color.hex()}
          modifiers={[size(28, 28)]}
        />
      }
    />
  );
};

export { listItemColors };

export default {
  Section,
  SubHeader,
  Item,
  Divider,
  InfoItem,
  Icon,
  ColorItem,
};
