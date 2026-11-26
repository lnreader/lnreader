import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import color from 'color';

import SkeletonLines from '../components/SkeletonLines';
import { useChapterReaderSettings } from '@hooks/persisted';

const ChapterLoadingScreen = () => {
  const {
    theme: backgroundColor,
    padding,
    textSize,
    lineHeight,
  } = useChapterReaderSettings();
  const [skeletonColor, highlightColor] = useMemo(() => {
    const background = color(backgroundColor);
    if (!background.isDark()) {
      return [
        background.darken(0.04).toString(),
        background.darken(0.08).toString(),
      ];
    }
    if (background.luminosity() !== 0) {
      return [
        background.lighten(0.1).toString(),
        background.lighten(0.4).toString(),
      ];
    }
    return [
      background.mix(color('#fff'), 0.08).hex(),
      background.mix(color('#fff'), 0.14).hex(),
    ];
  }, [backgroundColor]);

  return (
    <View style={[styles.container, { backgroundColor, padding }]}>
      <SkeletonLines
        color={skeletonColor}
        highlightColor={highlightColor}
        textSize={textSize}
        lineHeight={lineHeight}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ChapterLoadingScreen;
