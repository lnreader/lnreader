import React, { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';
import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';

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

const PluginsSkeletonLoading: React.FC<Props> = ({ theme }) => {
  const { width } = useWindowDimensions();
  const textWidth = Math.max(80, width - 168);
  const [highlightColor, backgroundColor, disableLoadingAnimations] =
    useLoadingColors(theme);
  const shimmerColors = [backgroundColor, highlightColor, backgroundColor];

  const renderRow = (
    { header }: (typeof SKELETON_ROWS)[number],
    index: number,
  ) => (
    <View key={`pluginsLoading${index}`}>
      {header ? (
        <View style={styles.headerRow}>
          <ShimmerPlaceholder
            style={styles.rounded}
            shimmerColors={shimmerColors}
            height={16}
            width={header}
            stopAutoRun={disableLoadingAnimations}
          />
        </View>
      ) : null}
      <View style={styles.pluginRow}>
        <ShimmerPlaceholder
          style={styles.icon}
          shimmerColors={shimmerColors}
          height={44}
          width={44}
          stopAutoRun={disableLoadingAnimations}
        />
        <View style={styles.details}>
          <ShimmerPlaceholder
            style={[styles.rounded, styles.name]}
            shimmerColors={shimmerColors}
            height={14}
            width={textWidth * 0.7}
            stopAutoRun={disableLoadingAnimations}
          />
          <ShimmerPlaceholder
            style={styles.rounded}
            shimmerColors={shimmerColors}
            height={12}
            width={textWidth * 0.4}
            stopAutoRun={disableLoadingAnimations}
          />
        </View>
        <ShimmerPlaceholder
          style={styles.button}
          shimmerColors={shimmerColors}
          height={24}
          width={24}
          stopAutoRun={disableLoadingAnimations}
        />
      </View>
    </View>
  );

  return (
    <View testID="plugins-skeleton" style={styles.container}>
      {SKELETON_ROWS.map(renderRow)}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    marginHorizontal: 8,
  },
  container: {
    flex: 1,
    overflow: 'hidden',
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
  },
  name: {
    marginBottom: 6,
  },
  pluginRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rounded: {
    borderRadius: 6,
  },
});

export default memo(PluginsSkeletonLoading);
