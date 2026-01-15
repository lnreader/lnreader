import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Switch from './Switch';
import { ThemeColors } from '../../theme/types';

interface SwitchItemProps {
  value: boolean;
  label: string;
  description?: string;
  onPress: () => void;
  theme: ThemeColors;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const SwitchItem: React.FC<SwitchItemProps> = ({
  label,
  description,
  onPress,
  theme,
  value,
  size,
  style,
}) => (
  <Pressable
    android_ripple={{ color: theme.rippleColor }}
    style={[styles.container, style]}
    onPress={onPress}
  >
    <View style={styles.labelContainer}>
      <Text style={[{ color: theme.onSurface }, styles.label]}>{label}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.onSurfaceVariant }]}>
          {description}
        </Text>
      ) : null}
    </View>
    <Switch
      value={value}
      onValueChange={onPress}
      style={styles.switch}
      size={size}
    />
  </Pressable>
);

export default SwitchItem;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  description: {
    fontSize: 12,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
  },
  labelContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  switch: {
    marginStart: 8,
  },
});
