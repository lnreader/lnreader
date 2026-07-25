import { memo, useMemo } from 'react';
import {
  DimensionValue,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAppSettings } from '@hooks/persisted/index';
import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';

interface Props {
  color?: string;
  containerHeight: DimensionValue;
  containerMargin?: DimensionValue;
  containerWidth: DimensionValue;
  highlightColor?: string;
  lineHeight: number;
  /**
   * How many lines actually shimmer. Every shimmering line costs a gradient
   * view plus an animation, and this placeholder is shown while the app is busy
   * loading, so the lines below the fold are rendered as plain bars.
   */
  maxAnimatedLines?: number;
  textSize: number;
  width?: DimensionValue;
}

const resolveDimension = (value: DimensionValue, available: number): number => {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return available;
  }
  return String(value).endsWith('%') ? available * (parsed / 100) : parsed;
};

const SkeletonLines = ({
  width,
  lineHeight,
  textSize,
  containerWidth,
  containerHeight,
  containerMargin = 0,
  color = '#ebebeb',
  highlightColor = '#c5c5c5',
  maxAnimatedLines = 12,
}: Props) => {
  const { disableLoadingAnimations } = useAppSettings();
  const window = useWindowDimensions();

  const resolvedWidth = width
    ? resolveDimension(width, window.width)
    : window.width * 0.9;
  const resolvedHeight = resolveDimension(containerHeight, window.height);
  const rowHeight = Math.max(textSize, textSize * lineHeight);
  const lineCount = Math.max(1, Math.floor((resolvedHeight - 10) / rowHeight));
  const lines = useMemo(() => Array.from({ length: lineCount }), [lineCount]);
  const styles = useMemo(
    () =>
      createStyleSheet(
        containerWidth,
        containerHeight,
        containerMargin,
        rowHeight - textSize,
      ),
    [containerHeight, containerMargin, containerWidth, rowHeight, textSize],
  );

  return (
    <View style={styles.container}>
      {lines.map((_, index) => {
        const lineWidth =
          index % 5 === 4 ? resolvedWidth * 0.68 : resolvedWidth;

        if (disableLoadingAnimations || index >= maxAnimatedLines) {
          return (
            <View
              key={`reader-line-skeleton-${index}`}
              style={[
                styles.line,
                {
                  backgroundColor: color,
                  height: textSize,
                  width: lineWidth,
                },
              ]}
            />
          );
        }

        return (
          <ShimmerPlaceholder
            key={`reader-line-skeleton-${index}`}
            style={styles.line}
            shimmerColors={[color, highlightColor, color]}
            width={lineWidth}
            height={textSize}
          />
        );
      })}
    </View>
  );
};

const createStyleSheet = (
  containerWidth: DimensionValue,
  containerHeight: DimensionValue,
  containerMargin: DimensionValue,
  lineSpacing: number,
) =>
  StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      height: containerHeight,
      margin: containerMargin,
      position: 'relative',
      width: containerWidth,
    },
    line: {
      borderRadius: 8,
      marginBottom: Math.max(0, lineSpacing),
    },
  });

export default memo(SkeletonLines);
