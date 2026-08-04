import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '@hooks/persisted';
import { overlay } from 'react-native-paper';

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    margin: 4,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export const StatsCard: React.FC<{
  label: string;
  value?: string | number;
}> = ({ label, value = 0 }) => {
  const theme = useTheme();

  if (!label) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.isDark
            ? overlay(2, theme.surface)
            : theme.secondaryContainer,
        },
      ]}
    >
      <Text style={[styles.value, { color: theme.primary }]}>{value}</Text>
      <Text style={{ color: theme.onSurface }}> {label}</Text>
    </View>
  );
};
