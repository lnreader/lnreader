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

interface TriStateCheckboxProps {
  label: string;
  status?: 'include' | 'exclude';
  onPress: () => void;
  disabled?: boolean;
  theme: ThemeColors;
}

/** Unset → include (checked) → exclude (crossed), as used for library filters. */
export const TriStateCheckbox = ({
  label,
  status,
  onPress,
  disabled,
  theme,
}: TriStateCheckboxProps) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="checkbox"
    accessibilityState={{
      checked: status === 'exclude' ? 'mixed' : status === 'include',
      disabled,
    }}
    android_ripple={{ color: theme.rippleColor }}
    style={[styles.pressable, styles.triStatePressable]}
    onPress={onPress}
    disabled={disabled}
  >
    <MaterialCommunityIcons
      name={
        status === 'exclude'
          ? 'close-box'
          : status === 'include'
          ? 'checkbox-marked'
          : 'checkbox-blank-outline'
      }
      color={
        disabled
          ? theme.onSurfaceDisabled
          : status
          ? theme.primary
          : theme.onSurfaceVariant
      }
      size={24}
      style={styles.triStateIcon}
    />
    <View style={styles.textContainer}>
      <Text
        style={[
          styles.defaultLabel,
          { color: disabled ? theme.onSurfaceDisabled : theme.onSurface },
        ]}
      >
        {label}
      </Text>
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
  // Matches the 36dp touch target of react-native-paper's Checkbox.
  triStateIcon: { margin: 6 },
  triStatePressable: { minHeight: 48 },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    marginStart: 12,
  },
});
