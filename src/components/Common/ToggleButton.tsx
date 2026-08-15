import React from 'react';
import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '../../theme/types';
import Color from 'color';
import { MaterialDesignIconName } from '@type/icon';
import { Pressable } from 'react-native-gesture-handler';

// --- Dynamic style helpers ---

const getToggleButtonPressableStyle = (
  selected: boolean,
  theme: ThemeColors,
  disabled?: boolean,
) => ({
  opacity: disabled ? 0.6 : 1,
  backgroundColor: selected
    ? Color(theme.primary).alpha(0.12).string()
    : 'transparent',
});

// --- Components ---

interface ToggleButtonProps {
  icon: MaterialDesignIconName;
  selected: boolean;
  theme: ThemeColors;
  color?: string;
  onPress: () => void;
  disabled?: boolean;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  icon,
  selected,
  theme,
  color,
  onPress,
  disabled,
}) => (
  <View style={styles.toggleButtonContainer}>
    <Pressable
      android_ripple={{ color: theme.rippleColor }}
      style={[
        styles.toggleButtonPressable,
        getToggleButtonPressableStyle(selected, theme, disabled),
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <MaterialCommunityIcons
        name={icon}
        color={selected ? theme.primary : color ? color : theme.onSurface}
        size={24}
      />
    </Pressable>
  </View>
);

interface ToggleColorButtonProps {
  selected: boolean;
  backgroundColor: string;
  textColor: string;
  theme: ThemeColors;
  onPress: () => void;
}

export const ToggleColorButton: React.FC<ToggleColorButtonProps> = ({
  selected,
  backgroundColor,
  textColor,
  theme,
  onPress,
}) => (
  <Pressable
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    android_ripple={{ color: theme.rippleColor, foreground: true }}
    style={[
      styles.toggleColorButtonContainer,
      {
        borderColor: selected ? theme.primary : 'transparent',
      },
    ]}
    onPress={onPress}
  >
    <View
      style={[
        styles.toggleColorButtonSwatch,
        {
          backgroundColor,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={selected ? 'check' : 'format-color-text'}
        color={textColor}
        size={24}
      />
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  toggleButtonContainer: {
    borderRadius: 6,
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  toggleButtonPressable: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleColorButtonContainer: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    marginHorizontal: 4,
    overflow: 'hidden',
    width: 48,
  },
  toggleColorButtonSwatch: {
    alignItems: 'center',
    borderRadius: 50,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
