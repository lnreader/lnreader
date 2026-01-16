import React, { ReactNode, useCallback } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import MaterialIcon from '@react-native-vector-icons/material-design-icons';

import { List as PaperList, Divider as PaperDivider } from 'react-native-paper';
import { ThemeColors } from '../../theme/types';

interface ListItemProps {
  title: string;
  description?: string | null;
  icon?: string;
  onPress?: () => void;
  theme: ThemeColors;
  disabled?: boolean;
  right?: string;
}

const Section = ({ children }: { children: ReactNode }) => (
  <PaperList.Section style={styles.listSection}>{children}</PaperList.Section>
);

const SubHeader = ({
  children,
  theme,
}: {
  children: ReactNode;
  theme: ThemeColors;
}) => (
  <PaperList.Subheader style={{ color: theme.primary }}>
    {children}
  </PaperList.Subheader>
);

const Item: React.FC<ListItemProps> = ({
  title,
  description,
  icon,
  onPress,
  theme,
  disabled,
  right,
}) => {
  const left = useCallback(() => {
    if (icon) {
      return (
        <PaperList.Icon
          color={theme.primary}
          icon={icon}
          style={styles.iconCtn}
        />
      );
    }
  }, [icon, theme.primary]);
  const rightIcon = useCallback(() => {
    if (right) {
      return (
        <PaperList.Icon
          color={theme.primary}
          icon={right}
          style={styles.iconCtn}
        />
      );
    }
  }, [right, theme.primary]);
  return (
    <PaperList.Item
      title={title}
      titleStyle={{
        color: disabled ? theme.onSurfaceDisabled : theme.onSurface,
      }}
      description={description}
      descriptionStyle={[
        styles.description,
        {
          color: disabled ? theme.onSurfaceDisabled : theme.onSurfaceVariant,
        },
      ]}
      left={left}
      right={rightIcon}
      disabled={disabled}
      onPress={onPress}
      rippleColor={theme.rippleColor}
      style={styles.listItemCtn}
    />
  );
};

const Divider = ({ theme }: { theme: ThemeColors }) => (
  <PaperDivider style={[styles.divider, { backgroundColor: theme.outline }]} />
);

const InfoItem = ({
  title,
  theme,
  style,
}: {
  title: string;
  icon?: string;
  theme: ThemeColors;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.infoCtn, style]}>
    <MaterialIcon
      size={20}
      color={theme.onSurfaceVariant}
      name={'information-outline'}
    />
    <Text style={[styles.infoMsg, { color: theme.onSurfaceVariant }]}>
      {title}
    </Text>
  </View>
);

const Icon = ({ icon, theme }: { icon: string; theme: ThemeColors }) => (
  <PaperList.Icon color={theme.primary} icon={icon} style={styles.margin0} />
);

interface ColorItemProps {
  title: string;
  description: string;
  theme: ThemeColors;
  onPress: () => void;
}

const ColorItem = ({ title, description, theme, onPress }: ColorItemProps) => (
  <Pressable
    style={styles.pressable}
    android_ripple={{ color: theme.rippleColor }}
    onPress={onPress}
  >
    <View>
      <Text style={[{ color: theme.onSurface }, styles.fontSize16]}>
        {title}
      </Text>
      <Text style={{ color: theme.onSurfaceVariant }}>{description}</Text>
    </View>
    <View
      style={[
        {
          backgroundColor: description,
        },
        styles.descriptionView,
      ]}
    />
  </Pressable>
);

export default {
  Section,
  SubHeader,
  Item,
  Divider,
  InfoItem,
  Icon,
  ColorItem,
};

const styles = StyleSheet.create({
  margin0: { margin: 0 },
  fontSize16: {
    fontSize: 16,
  },
  descriptionView: {
    height: 24,
    width: 24,
    borderRadius: 50,
    marginEnd: 16,
  },
  description: {
    fontSize: 12,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    opacity: 0.5,
  },
  iconCtn: {
    paddingStart: 16,
  },
  infoCtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoMsg: {
    fontSize: 12,
    marginTop: 12,
  },
  listItemCtn: {
    paddingVertical: 12,
  },
  listSection: {
    flex: 1,
    marginVertical: 0,
  },
  pressable: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
