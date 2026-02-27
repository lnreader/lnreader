import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '../../theme/types';
import Color from 'color';
import { MaterialDesignIconName } from '@type/icon';

// --- Dynamic style helpers ---

const getToggleButtonPressableStyle = (
  selected: boolean,
  theme: ThemeColors,
) => ({
  backgroundColor: selected
    ? Color(theme.primary).alpha(0.12).string()
    : 'transparent',
});

const getToggleColorButtonPressableStyle = (backgroundColor: string) => ({
  backgroundColor,
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
        getToggleButtonPressableStyle(selected, theme),
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
  onPress: () => void;
}

export const ToggleColorButton: React.FC<ToggleColorButtonProps> = ({
  selected,
  backgroundColor,
  textColor,
  onPress,
}) => (
  <View style={styles.toggleColorButtonContainer}>
    <Pressable
      android_ripple={{ color: textColor }}
      style={[
        styles.toggleColorButtonPressable,
        getToggleColorButtonPressableStyle(backgroundColor),
      ]}
      onPress={onPress}
    >
      <MaterialCommunityIcons
        name={selected ? 'check' : 'format-color-text'}
        color={textColor}
        size={24}
      />
    </Pressable>
  </View>
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
    borderRadius: 50,
    overflow: 'hidden',
    marginHorizontal: 6,
    height: 44,
    width: 44,
  },
  toggleColorButtonPressable: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
