import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeColors } from '../../theme/types';
import { overlay } from 'react-native-paper';

interface ChipProps {
  label: string;
  theme: ThemeColors;
}

const Chip: React.FC<ChipProps> = ({ label, theme }) => (
  <View
    style={[
      styles.chipContainer,
      {
        backgroundColor: theme.isDark
          ? overlay(1, theme.surface)
          : theme.secondaryContainer,
      },
    ]}
  >
    <Pressable
      android_ripple={{ color: theme.rippleColor }}
      style={styles.pressable}
    >
      <Text
        style={[
          styles.label,
          {
            color: theme.isDark ? theme.onSurface : theme.onSecondaryContainer,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  </View>
);

export default Chip;

const styles = StyleSheet.create({
  chipContainer: {
    borderRadius: 8,
    height: 32,
    marginEnd: 8,
    overflow: 'hidden',
  },
  label: {
    fontSize: 12,
  },
  pressable: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
