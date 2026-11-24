import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';

const SKELETON_ROWS = [
  { header: 96 },
  { header: null },
  { header: null },
  { header: null },
  { header: 72 },
  { header: null },
  { header: null },
  { header: null },
  { header: null },
  { header: null },
] as const;

interface Props {
  theme: ThemeColors;
}

// This mounts in the same commit as the tab press, so it uses plain views and
// a single UI-thread pulse rather than one gradient shimmer per placeholder.
const PluginsSkeletonLoading: React.FC<Props> = ({ theme }) => {
  const [, backgroundColor, disableLoadingAnimations] = useLoadingColors(theme);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!disableLoadingAnimations) {
      opacity.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
    }
    return () => {
      cancelAnimation(opacity);
      opacity.value = 1;
    };
  }, [disableLoadingAnimations, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const block = { backgroundColor };

  return (
    <Animated.View
      testID="plugins-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, pulseStyle]}
    >
      {SKELETON_ROWS.map(({ header }, index) => (
        <View key={`pluginsLoading${index}`}>
          {header ? (
            <View style={styles.headerRow}>
              <View style={[styles.text, block, { width: header }]} />
            </View>
          ) : null}
          <View style={styles.pluginRow}>
            <View style={[styles.icon, block]} />
            <View style={styles.details}>
              <View style={[styles.text, styles.name, block]} />
              <View style={[styles.text, styles.description, block]} />
            </View>
            <View style={[styles.button, block]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    height: 24,
    marginHorizontal: 8,
    width: 24,
  },
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  description: {
    height: 12,
    width: '40%',
  },
  details: {
    flex: 1,
    marginStart: 16,
  },
  headerRow: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  icon: {
    borderRadius: 4,
    height: 44,
    width: 44,
  },
  name: {
    marginBottom: 6,
    width: '70%',
  },
  pluginRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    borderRadius: 6,
    height: 14,
  },
});

export default memo(PluginsSkeletonLoading);
