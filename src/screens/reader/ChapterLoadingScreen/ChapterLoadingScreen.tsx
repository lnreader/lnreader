import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import color from 'color';

import { AppHost } from '@components';
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
      background.negate().darken(0.98).toString(),
      background.negate().darken(0.92).toString(),
    ];
  }, [backgroundColor]);

  return (
    // Laid over the reader page, which keeps loading underneath.
    <AppHost style={[styles.container, { backgroundColor }]}>
      <SkeletonLines
        containerMargin={padding}
        containerHeight={'100%'}
        color={skeletonColor}
        highlightColor={highlightColor}
        textSize={textSize}
        lineHeight={lineHeight}
      />
    </AppHost>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
});

export default ChapterLoadingScreen;
