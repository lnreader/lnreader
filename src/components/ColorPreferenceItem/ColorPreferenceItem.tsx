import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeColors } from '../../theme/types';

interface ColorPreferenceItemProps {
  label: string;
  description?: string;
  onPress: () => void;
  theme: ThemeColors;
}

const ColorPreferenceItem: React.FC<ColorPreferenceItemProps> = ({
  label,
  description,
  theme,
  onPress,
}) => (
  <Pressable
    style={styles.container}
    android_ripple={{ color: theme.rippleColor }}
    onPress={onPress}
  >
    <View>
      <Text style={[styles.label, { color: theme.onSurface }]}>{label}</Text>
      <Text style={{ color: theme.onSurfaceVariant }}>
        {description?.toUpperCase?.()}
      </Text>
    </View>
    <View style={[{ backgroundColor: description }, styles.colorPreview]} />
  </Pressable>
);

export default ColorPreferenceItem;

const styles = StyleSheet.create({
  colorPreview: {
    borderRadius: 50,
    height: 24,
    marginEnd: 16,
    width: 24,
  },
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  label: {
    fontSize: 16,
  },
});
