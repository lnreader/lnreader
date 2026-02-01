import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Switch from '@components/Switch/Switch';
import { ThemeColors } from '@theme/types';

interface FilterSwitchProps {
  theme: ThemeColors;
  label: string;
  value: boolean;
  onToggle: () => void;
}

export default function FilterSwitch({
  theme,
  label,
  value,
  onToggle,
}: FilterSwitchProps) {
  return (
    <Pressable
      android_ripple={{ color: theme.rippleColor }}
      style={styles.container}
      onPress={onToggle}
    >
      <View style={styles.switchContainer}>
        <View style={styles.switchLabelContainer}>
          <Text style={[{ color: theme.onSurface }, styles.switchLabel]}>
            {label}
          </Text>
        </View>
        <Switch value={value} onValueChange={onToggle} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  switchContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  switchLabel: { fontSize: 16 },
  switchLabelContainer: { flex: 1, justifyContent: 'center' },
});
