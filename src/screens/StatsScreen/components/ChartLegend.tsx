import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@theme/types';
import Animated from 'react-native-reanimated';

export interface ChartLegendEntry {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface ChartLegendProps {
  entries: ChartLegendEntry[];
  highlightedKey?: string;
  onEntryPress: (key: string) => void;
  theme: ThemeColors;
}

const ChartLegend: React.FC<ChartLegendProps> = ({
  entries,
  highlightedKey,
  onEntryPress,
  theme,
}) => {
  return (
    <View style={styles.legendContainer}>
      {entries.map(entry => {
        const isHighlighted = highlightedKey === entry.key;
        return (
          <Pressable
            key={entry.key}
            onPress={() => onEntryPress(entry.key)}
            style={styles.legendRow}
          >
            <Animated.View
              style={[
                styles.legendDot,
                {
                  backgroundColor: entry.color,
                  borderWidth: isHighlighted ? 2 : 0,
                  width: isHighlighted ? 16 : 12,
                  height: isHighlighted ? 16 : 12,
                  marginLeft: isHighlighted ? 0 : 2,
                  marginRight: isHighlighted ? 6 : 8,
                  transitionDuration: '150ms',
                  transitionProperty: 'all',
                  borderColor: theme.onSurface,
                },
              ]}
            />
            <Text
              style={[styles.legendLabel, { color: theme.onSurface }]}
              numberOfLines={1}
            >
              {entry.label}
            </Text>
            <Text
              style={[styles.legendValue, { color: theme.onSurfaceVariant }]}
            >
              {entry.value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  legendContainer: {
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    borderRadius: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
  },
  legendValue: {
    fontSize: 14,
    textAlign: 'right',
    width: 40,
  },
});

export default ChartLegend;
