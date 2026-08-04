import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DonutChart } from './DonutChart';
import ChartLegend, { type ChartLegendEntry } from './ChartLegend';
import type { ThemeColors } from '@theme/types';

interface DonutChartWithLegendProps {
  title: string;
  entries: { key: string; value: number }[];
  size?: number;
  thickness?: number;
  colors: Record<string, string>;
  theme: ThemeColors;
  centerLabel?: string;
  getLabel?: (key: string) => string;
}

const DonutChartWithLegend: React.FC<DonutChartWithLegendProps> = ({
  title,
  entries,
  size = 160,
  thickness = 28,
  colors,
  theme,
  centerLabel,
  getLabel,
}) => {
  const [highlightedKey, setHighlightedKey] = useState<string | undefined>(
    undefined,
  );

  const handleSegmentPress = useCallback(
    (key: string) =>
      setHighlightedKey(prev => (prev === key ? undefined : key)),
    [],
  );
  const legendEntries: ChartLegendEntry[] = entries
    .filter(e => e.value > 0)
    .map(e => ({
      key: e.key,
      label: getLabel ? getLabel(e.key) : e.key,
      value: e.value,
      color: colors[e.key] || theme.outline,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <View>
      <Text style={[styles.header, { color: theme.onSurfaceVariant }]}>
        {title}
      </Text>
      <View style={styles.donutContainer}>
        <DonutChart
          entries={entries}
          size={size}
          thickness={thickness}
          colors={colors}
          centerLabel={centerLabel}
          highlightedKey={highlightedKey}
          onSegmentPress={handleSegmentPress}
        />
      </View>
      <ChartLegend
        entries={legendEntries}
        highlightedKey={highlightedKey}
        onEntryPress={handleSegmentPress}
        theme={theme}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    fontWeight: 'bold',
    paddingVertical: 16,
  },
  donutContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
});

export default DonutChartWithLegend;
