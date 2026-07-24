import { StyleSheet, Text, TextStyle, View } from 'react-native';
import React from 'react';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { Slider } from '@components';
import { getString } from '@i18n/translations';

interface ReaderTextSizeProps {
  labelStyle?: TextStyle | TextStyle[];
}

const ReaderTextSize: React.FC<ReaderTextSizeProps> = ({ labelStyle }) => {
  const theme = useTheme();
  const { textSize, setChapterReaderSettings } = useChapterReaderSettings();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[{ color: theme.onSurfaceVariant }, labelStyle]}>
          {getString('readerScreen.bottomSheet.textSize')}
        </Text>
        <Text style={[styles.value, { color: theme.onSurface }]}>
          {textSize}px
        </Text>
      </View>
      <Slider
        value={textSize}
        min={12}
        max={20}
        step={1}
        showStops
        showValueIndicator
        formatValue={value => `${value}px`}
        accessibilityLabel={getString('readerScreen.bottomSheet.textSize')}
        onSlidingComplete={value =>
          setChapterReaderSettings({ textSize: value })
        }
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
