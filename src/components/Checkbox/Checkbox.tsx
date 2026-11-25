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
import { Host, TriStateCheckbox } from '@expo/ui/jetpack-compose';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getString } from '@i18n/translations';

import { ThemeColors } from '../../theme/types';

interface CheckboxProps {
  label: string;
  status: boolean | 'indeterminate' | 'excluded';
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
    accessibilityLabel={
      status === 'excluded'
        ? getString('common.excludedItem', { name: label })
        : label
    }
    accessibilityRole="checkbox"
    accessibilityState={{
      checked: status === 'indeterminate' ? 'mixed' : status === true,
      disabled,
    }}
    android_ripple={{ color: theme.rippleColor }}
    style={[styles.pressable, viewStyle]}
    onPress={onPress}
    disabled={disabled}
  >
    {/* Display-only: the row Pressable owns touch and ripple, so the checkbox
        must not draw its own ripple, which gets clipped by the row bounds. */}
    <View pointerEvents="none" style={styles.checkboxContainer}>
      {status === 'excluded' ? (
        <MaterialCommunityIcons
          name="close-box"
          color={theme.primary}
          size={24}
        />
      ) : (
        <Host matchContents>
          <TriStateCheckbox
            state={
              status === 'indeterminate'
                ? 'indeterminate'
                : status
                ? 'on'
                : 'off'
            }
            enabled={!disabled}
            colors={{
              checkedColor: theme.primary,
              uncheckedColor: theme.onSurfaceVariant,
              checkmarkColor: theme.onPrimary,
              disabledCheckedColor: theme.onSurfaceDisabled,
              disabledUncheckedColor: theme.onSurfaceDisabled,
              disabledIndeterminateColor: theme.onSurfaceDisabled,
            }}
          />
        </Host>
      )}
    </View>
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
  checkboxContainer: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
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
