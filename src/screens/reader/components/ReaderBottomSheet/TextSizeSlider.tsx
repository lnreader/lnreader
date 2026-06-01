import { StyleSheet, Text, View } from 'react-native';
import React, { useState, useEffect } from 'react';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import Slider from '@react-native-community/slider';
import { getString } from '@strings/translations';

const TRACK_TINT_COLOR = '#000000';

const TextSizeSlider: React.FC = () => {
  const theme = useTheme();
  const { textSize, setChapterReaderSettings } = useChapterReaderSettings();
  const [localSize, setLocalSize] = useState(textSize);

  useEffect(() => {
    setLocalSize(textSize);
  }, [textSize]);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
        {getString('readerScreen.bottomSheet.textSize')}
      </Text>
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          value={textSize}
          minimumValue={12}
          maximumValue={40}
          step={1}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={TRACK_TINT_COLOR}
          thumbTintColor={theme.primary}
          onValueChange={setLocalSize}
          onSlidingComplete={value =>
            setChapterReaderSettings({ textSize: value })
          }
        />
        <Text style={[styles.value, { color: theme.onSurface }]}>
          {localSize}px
        </Text>
      </View>
    </View>
  );
};

export default TextSizeSlider;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  label: {
    textAlign: 'center',
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  value: {
    paddingHorizontal: 4,
    textAlign: 'center',
    width: 60,
    fontSize: 15,
  },
});
