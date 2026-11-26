import { memo, useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { MaskedView } from '@expo/ui/community/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { css, useReducedMotion } from 'react-native-reanimated';
import { useAppSettings } from '@hooks/persisted';

type Props = {
  color: string;
  highlightColor: string;
  lineHeight: number;
  textSize: number;
};

const sweep = css.keyframes({
  from: { transform: [{ translateX: '-100%' }] },
  to: { transform: [{ translateX: '100%' }] },
});

const SkeletonLines = ({
  color,
  highlightColor,
  lineHeight,
  textSize,
}: Props) => {
  const { disableLoadingAnimations } = useAppSettings();
  const reducedMotion = useReducedMotion();
  const window = useWindowDimensions();
  const [height, setHeight] = useState<number>();
  const rowHeight = Math.max(textSize, textSize * lineHeight);
  const lineCount = Math.max(
    1,
    Math.floor((height ?? window.height) / rowHeight),
  );

  const rows = (
    <View style={styles.container}>
      {Array.from({ length: lineCount }, (_, index) => (
        <View
          key={index}
          style={[
            styles.line,
            {
              backgroundColor: color,
              height: textSize,
              marginBottom: rowHeight - textSize,
              width: index % 5 === 4 ? '61.2%' : '90%',
            },
          ]}
        />
      ))}
    </View>
  );

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setHeight(nativeEvent.layout.height);
  };

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleLayout}
      style={styles.container}
    >
      {disableLoadingAnimations || reducedMotion ? (
        rows
      ) : (
        <MaskedView style={styles.container} maskElement={rows}>
          <View style={[styles.container, { backgroundColor: color }]}>
            <Animated.View style={styles.sweep}>
              <LinearGradient
                colors={[color, highlightColor, color]}
                locations={[0.25, 0.5, 0.75]}
                start={[0, 0.5]}
                end={[1, 0.5]}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </MaskedView>
      )}
    </View>
  );
};

const styles = css.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  line: {
    borderRadius: 8,
    flexShrink: 0,
  },
  sweep: {
    ...StyleSheet.absoluteFill,
    animationName: sweep,
    animationDuration: 1800,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
});

export default memo(SkeletonLines);
