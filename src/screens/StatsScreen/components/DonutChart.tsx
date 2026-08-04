import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G, PathProps } from 'react-native-svg';

import { useTheme } from '@hooks/persisted';
import { ThemeColors } from '@theme/types';
import color from 'color';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  withSpring,
} from 'react-native-reanimated';

const PULL_OFFSET = 8;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function toRadians(angle: number) {
  return (angle * Math.PI) / 180;
}

export function getDonutPalette(
  keys: string[],
  theme: ThemeColors,
): Record<string, string> {
  const bases = [
    theme.primary,
    theme.primaryContainer,
    theme.tertiary,
    theme.tertiaryContainer,
    theme.secondary,
    theme.secondaryContainer,
    theme.surface,
    theme.surfaceVariant,
    theme.onPrimary,
  ];
  const result: Record<string, string> = {};
  keys.forEach((key, i) => {
    const base = bases[i % bases.length];
    const cycle = Math.floor(i / bases.length);
    if (cycle === 0) {
      result[key] = base;
    } else {
      const factor = cycle * 0.15;
      result[key] = theme.isDark
        ? color(base).lighten(factor).hex()
        : color(base).darken(factor).hex();
    }
  });
  return result;
}

interface DonutChartProps {
  entries: { key: string; value: number }[];
  size: number;
  thickness: number;
  colors: Record<string, string>;
  centerLabel?: string;
  highlightedKey?: string;
  onSegmentPress?: (key: string) => void;
}

interface SegmentData {
  key: string;
  color: string;
  startAngle: number;
  endAngle: number;
}

type DonutChartSegmentProps = SegmentData & {
  segKey: string;
  cx: number;
  cy: number;
  radius: number;
  innerRadius: number;
  isHighlighted: boolean;
  onPress?: (key: string) => void;
};

const config = {
  duration: 150,
  dampingRatio: 0.75,
  mass: 4,
  overshootClamping: undefined,
  energyThreshold: 6e-9,
  velocity: 0,
  reduceMotion: ReduceMotion.System,
};

const DonutChartSegment = ({
  segKey,
  color: segColor,
  startAngle,
  endAngle,
  onPress,
  isHighlighted,
  cx,
  cy,
  radius,
  innerRadius,
}: DonutChartSegmentProps) => {
  const path = useMemo(() => {
    const polar = (angle: number, r: number) => ({
      x: cx + r * Math.cos(toRadians(angle)),
      y: cy + r * Math.sin(toRadians(angle)),
    });

    const outerStart = polar(startAngle, radius);
    const outerEnd = polar(endAngle, radius);
    const innerStart = polar(startAngle, innerRadius);
    const innerEnd = polar(endAngle, innerRadius);

    const sweepAngle = (((endAngle - startAngle) % 360) + 360) % 360;
    const largeArcFlag = sweepAngle > 180 ? 1 : 0;

    return [
      `M ${innerStart.x} ${innerStart.y}`,
      `L ${outerStart.x} ${outerStart.y}`,
      `A ${radius} ${radius}`,
      `0 ${largeArcFlag} 1`,
      `${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerRadius} ${innerRadius}`,
      `0 ${largeArcFlag} 0`,
      `${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  }, [cx, cy, startAngle, endAngle, radius, innerRadius]);

  const animatedProps = useAnimatedProps<PathProps>(() => {
    const midAngle = (startAngle + endAngle) / 2;
    const midAngleRadians = (midAngle * Math.PI) / 180;
    const targetX = PULL_OFFSET * Math.cos(midAngleRadians);
    const targetY = PULL_OFFSET * Math.sin(midAngleRadians);
    return {
      transform: [
        {
          translateX: withSpring(isHighlighted ? targetX : 0, config),
        },
        {
          translateY: withSpring(isHighlighted ? targetY : 0, config),
        },
      ],
    };
  }, [isHighlighted]);

  return (
    <G onPress={() => onPress?.(segKey)}>
      <AnimatedPath animatedProps={animatedProps} d={path} fill={segColor} />
    </G>
  );
};

export const DonutChart: React.FC<DonutChartProps> = ({
  entries,
  size,
  thickness,
  colors,
  centerLabel,
  highlightedKey,
  onSegmentPress,
}) => {
  const theme = useTheme();

  const total = entries.reduce((s, e) => s + e.value, 0);
  if (total === 0) return null;

  const totalSize = size + PULL_OFFSET * 2;
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  const radius = size / 2 - 1; // slight inset to avoid clipping
  const innerRadius = radius - thickness;
  const active = entries.filter(e => e.value > 0);

  // Build accumulated angles (math coords, CW from 3 o'clock)
  const segments: SegmentData[] = [];
  let cursor = 0;

  for (const entry of active) {
    const angle = (entry.value / total) * 360;
    segments.push({
      key: entry.key,
      color: colors[entry.key] || theme.outline,
      startAngle: cursor,
      endAngle: cursor + angle,
    });
    cursor += angle;
  }

  return (
    <View
      style={{
        width: totalSize,
        height: totalSize,
        position: 'relative',
      }}
    >
      <Svg width={totalSize} height={totalSize}>
        <G>
          {segments.map(seg => {
            const { key, ...p } = seg;
            const isHighlighted = highlightedKey === key;
            const props = {
              ...p,
              segKey: key,
              cx,
              cy,
              radius,
              innerRadius,
              isHighlighted,
              onPress: onSegmentPress,
            };
            return <DonutChartSegment key={key} {...props} />;
          })}
        </G>
      </Svg>

      {/* Center count */}
      <View
        style={[styles.centerLabel, { width: totalSize, height: totalSize }]}
      >
        <Text style={[styles.centerCount, { color: theme.onSurface }]}>
          {total}
        </Text>
        <Text style={[styles.centerUnit, { color: theme.onSurfaceVariant }]}>
          {centerLabel}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerCount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  centerUnit: {
    fontSize: 11,
  },
});
