import { StyleSheet, Text, TextStyle, View } from 'react-native';
import React, { useState } from 'react';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { Slider } from '@components';
import { ChapterReaderSettings } from '@hooks/persisted/useSettings';

type ValueKey<T extends object> = Exclude<
  {
    [K in keyof T]: T[K] extends number ? K : never;
  }[keyof T],
  undefined
>;

interface ReaderValueChangeProps {
  labelStyle?: TextStyle | TextStyle[];
  valueChange?: number;
  label: string;
  valueKey: ValueKey<ChapterReaderSettings>;
  decimals?: number;
  min?: number;
  max?: number;
  unit?: string;
}

const ReaderValueChange: React.FC<ReaderValueChangeProps> = ({
  labelStyle,
  label,
  valueChange = 0.1,
  valueKey,
  decimals = 1,
  min = 1.3,
  max = 2,
  unit = '×',
}) => {
  const theme = useTheme();
  const { setChapterReaderSettings, ...settings } = useChapterReaderSettings();
  const [dragValue, setDragValue] = useState<number>();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[{ color: theme.onSurfaceVariant }, labelStyle]}>
          {label}
        </Text>
        <Text style={[styles.value, { color: theme.onSurface }]}>
          {`${(dragValue ?? settings[valueKey]).toFixed(decimals)}${unit}`}
        </Text>
      </View>
      <Slider
        value={settings[valueKey]}
        min={min}
        max={max}
        step={valueChange}
        showStops
        accessibilityLabel={label}
        onValueChange={setDragValue}
        onSlidingComplete={value => {
          setDragValue(undefined);
          setChapterReaderSettings({ [valueKey]: value });
        }}
      />
    </View>
  );
};

export default ReaderValueChange;

const styles = StyleSheet.create({
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  value: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
