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
  descriptionNumberOfLines?: number;
  onPress: () => void;
  onLongPress?: () => void;
  theme: ThemeColors;
  style?: StyleProp<ViewStyle>;
}

const SwitchItem: React.FC<SwitchItemProps> = ({
  label,
  description,
  descriptionNumberOfLines,
  onPress,
  onLongPress,
  theme,
  value,
  style,
}) => (
  <Pressable
    android_ripple={{ color: theme.rippleColor }}
    style={[styles.container, style]}
    onPress={onPress}
    onLongPress={onLongPress}
  >
    <View style={styles.labelContainer}>
      <Text style={[{ color: theme.onSurface }, styles.label]}>{label}</Text>
      {description ? (
        <Text
          numberOfLines={descriptionNumberOfLines}
          style={[styles.description, { color: theme.onSurfaceVariant }]}
        >
          {description}
        </Text>
      ) : null}
    </View>
    <Switch value={value} onValueChange={onPress} style={styles.switch} />
  </Pressable>
);

export default SwitchItem;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  description: {
    fontSize: 14,
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
