import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Checkbox as PaperCheckbox } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { ThemeColors } from '../../theme/types';

interface CheckboxProps {
  label: string;
  status: boolean | 'indeterminate';
  onPress?: () => void;
  disabled?: boolean;
  theme: ThemeColors;
  viewStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  status,
  theme,
  disabled,
  onPress,
  viewStyle,
  labelStyle,
}) => (
  <Pressable
    android_ripple={{ color: theme.rippleColor }}
    style={[styles.pressable, viewStyle]}
    onPress={onPress}
    disabled={disabled}
  >
    <PaperCheckbox
      status={
        status === 'indeterminate'
          ? 'indeterminate'
          : status
            ? 'checked'
            : 'unchecked'
      }
      onPress={onPress}
      color={theme.primary}
      theme={{
        colors: { disabled: theme.onSurfaceVariant },
      }}
      uncheckedColor={theme.onSurfaceVariant}
      disabled={disabled}
    />
    <Text style={[styles.defaultLabel, { color: theme.onSurface }, labelStyle]}>
      {label}
    </Text>
  </Pressable>
);

interface SortItemProps {
  label: string;
  status?: string;
  onPress: () => void;
  theme: ThemeColors;
}
export const SortItem = ({ label, status, onPress, theme }: SortItemProps) => (
  <Pressable
    android_ripple={{ color: theme.rippleColor }}
    style={[styles.pressable, styles.sortItem]}
    onPress={onPress}
  >
    {status ? (
      <MaterialCommunityIcons
        name={status === 'asc' ? 'arrow-up' : 'arrow-down'}
        color={theme.primary}
        size={21}
        style={styles.icon}
      />
    ) : null}
    <Text style={{ color: theme.onSurface }}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  defaultLabel: {
    marginStart: 12,
  },
  icon: {
    alignSelf: 'center',
    start: 24,
    position: 'absolute',
  },
  pressable: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sortItem: { paddingVertical: 16, paddingStart: 64 },
});
