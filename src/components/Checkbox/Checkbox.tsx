import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
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
  description?: string;
  descriptionStyle?: StyleProp<TextStyle>;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  status,
  theme,
  disabled,
  onPress,
  viewStyle,
  labelStyle,
  description,
  descriptionStyle,
}) => (
  <Pressable
    accessibilityHint={description}
    accessibilityLabel={label}
    accessibilityRole="checkbox"
    accessibilityState={{
      checked: status === 'indeterminate' ? 'mixed' : status,
      disabled,
    }}
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
    <View style={styles.textContainer}>
      <Text
        style={[styles.defaultLabel, { color: theme.onSurface }, labelStyle]}
      >
        {label}
      </Text>
      {description ? (
        <Text
          style={[
            styles.description,
            {
              color: disabled
                ? theme.onSurfaceDisabled
                : theme.onSurfaceVariant,
            },
            descriptionStyle,
          ]}
        >
          {description}
        </Text>
      ) : null}
    </View>
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
    flexShrink: 1,
  },
  description: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
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
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    marginStart: 12,
  },
});
