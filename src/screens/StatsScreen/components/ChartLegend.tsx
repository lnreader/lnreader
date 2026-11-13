import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@theme/types';
import Animated from 'react-native-reanimated';
import { useAppSettings } from '@hooks/persisted/useSettings';

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
  const { reduceAppAnimations = false } = useAppSettings();
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);

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
                  transitionDuration: reduceAppAnimations ? '0ms' : '150ms',
                  transitionProperty: 'all',
                  borderColor: theme.onSurface,
                },
              ]}
            />
            <Text
              style={[styles.legendLabel, { color: theme.onSurface }]}
              numberOfLines={2}
            >
              {entry.label}
            </Text>
            <Text style={[styles.legendValue, { color: theme.onSurface }]}>
              {entry.value}
            </Text>
            <Text
              style={[styles.legendPercent, { color: theme.onSurfaceVariant }]}
            >
              {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  legendContainer: {
    flex: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    gap: 5,
  },
  legendDot: {
    borderRadius: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  legendValue: {
    fontSize: 13,
    textAlign: 'right',
    minWidth: 20,
  },
  legendPercent: {
    fontSize: 11,
    minWidth: 32,
    textAlign: 'right',
  },
});

export default ChartLegend;
