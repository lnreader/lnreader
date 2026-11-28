import { StyleSheet, Text, TextStyle, View } from 'react-native';
import React, { useState } from 'react';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { Slider } from '@components';
import { getString } from '@i18n/translations';

interface ReaderTextSizeProps {
  labelStyle?: TextStyle | TextStyle[];
}

const ReaderTextSize: React.FC<ReaderTextSizeProps> = ({ labelStyle }) => {
  const theme = useTheme();
  const { textSize, setChapterReaderSettings } = useChapterReaderSettings();
  const [dragValue, setDragValue] = useState<number>();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[{ color: theme.onSurfaceVariant }, labelStyle]}>
          {getString('readerScreen.bottomSheet.textSize')}
        </Text>
        <Text style={[styles.value, { color: theme.onSurface }]}>
          {dragValue ?? textSize}px
        </Text>
      </View>
      <Slider
        value={textSize}
        min={12}
        max={50}
        step={1}
        showStops
        accessibilityLabel={getString('readerScreen.bottomSheet.textSize')}
        onValueChange={setDragValue}
        onSlidingComplete={value => {
          setDragValue(undefined);
          setChapterReaderSettings({ textSize: value });
        }}
      />
    </View>
  );
};

export default ReaderTextSize;

const styles = StyleSheet.create({
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  container: {
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
});
