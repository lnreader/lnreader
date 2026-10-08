import { memo, useMemo } from 'react';
import { DimensionValue, useWindowDimensions } from 'react-native';
import { Box, Column } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxSize,
  height,
  padding,
  Shapes,
  width as widthModifier,
} from '@expo/ui/jetpack-compose/modifiers';
import { useAppSettings } from '@hooks/persisted/index';
import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';

interface Props {
  color?: string;
  containerHeight: DimensionValue;
  containerMargin?: number;
  highlightColor?: string;
  lineHeight: number;
  /**
   * How many lines actually shimmer. Every shimmering line costs its own
   * animation, and this placeholder is shown while the app is busy loading,
   * so the lines below the fold are rendered as plain bars.
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
  containerHeight,
  containerMargin = 0,
  color = '#ebebeb',
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
  const lineSpacing = Math.max(0, rowHeight - textSize);

  return (
    <Column
      verticalArrangement={{ spacedBy: lineSpacing }}
      modifiers={[
        fillMaxSize(),
        padding(
          containerMargin,
          containerMargin,
          containerMargin,
          containerMargin,
        ),
      ]}
    >
      {lines.map((_, index) => {
        const lineWidth =
          index % 5 === 4 ? resolvedWidth * 0.68 : resolvedWidth;

        if (disableLoadingAnimations || index >= maxAnimatedLines) {
          return (
            <Box
              key={`reader-line-skeleton-${index}`}
              modifiers={[
                widthModifier(lineWidth),
                height(textSize),
                clip(Shapes.RoundedCorner(8)),
                background(color),
              ]}
            />
          );
        }

        return (
          <ShimmerPlaceholder
            key={`reader-line-skeleton-${index}`}
            corner={8}
            shimmerColors={[color]}
            width={lineWidth}
            height={textSize}
          />
        );
      })}
    </Column>
  );
};

export default memo(SkeletonLines);
