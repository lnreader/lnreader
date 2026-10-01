import React from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { AppText, Slider } from '@components';
import { ChapterReaderSettings } from '@hooks/persisted/useSettings';

type ValueKey<T extends object> = Exclude<
  {
    [K in keyof T]: T[K] extends number ? K : never;
  }[keyof T],
  undefined
>;

interface ReaderValueChangeProps {
  valueChange?: number;
  label: string;
  valueKey: ValueKey<ChapterReaderSettings>;
  decimals?: number;
  min?: number;
  max?: number;
  unit?: string;
}

const ReaderValueChange: React.FC<ReaderValueChangeProps> = ({
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
  const [dragValue, setDragValue] = React.useState<number>();
  const value = dragValue ?? settings[valueKey] ?? min;

  return (
    <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <AppText
          variant="bodyMedium"
          color={theme.onSurfaceVariant}
          modifiers={[weight(1)]}
        >
          {label}
        </AppText>
        <AppText variant="labelLarge">
          {`${((value * 10) / 10).toFixed(decimals)}${unit}`}
        </AppText>
      </Row>
      <Slider
        value={settings[valueKey] ?? min}
        min={min}
        max={max}
        step={valueChange}
        showStops
        onValueChange={setDragValue}
        onSlidingComplete={next => {
          setDragValue(undefined);
          setChapterReaderSettings({ [valueKey]: next });
        }}
      />
    </Column>
  );
};

export default ReaderValueChange;
