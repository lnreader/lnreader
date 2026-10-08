import React, { memo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';

import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';
import useLoadingColors from '@utils/useLoadingColors';

interface Props {
  theme: ThemeColors;
}

const SKELETON_ITEMS = [
  { height: 128, lastLineRatio: 0.72 },
  { height: 142, lastLineRatio: 0.54 },
  { height: 136, lastLineRatio: 0.8 },
  { height: 148, lastLineRatio: 0.62 },
  { height: 132, lastLineRatio: 0.7 },
] as const;

const MalLoading: React.FC<Props> = ({ theme }) => {
  const { width } = useWindowDimensions();
  const textWidth = Math.max(80, width - 140);
  const [, backgroundColor, disableLoadingAnimations] = useLoadingColors(theme);

  return (
    <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 8)]}>
      {SKELETON_ITEMS.map((item, index) => (
        <Row
          key={`mal-skeleton-${index}`}
          modifiers={[
            fillMaxWidth(),
            padding(10, 10, 10, 10),
            clip(Shapes.RoundedCorner(8)),
            background(theme.overlay3 ?? theme.surfaceVariant),
          ]}
        >
          <ShimmerPlaceholder
            shimmerColors={[backgroundColor]}
            corner={0}
            height={item.height}
            width={100}
            stopAutoRun={disableLoadingAnimations}
          />
          <Column modifiers={[weight(1), padding(10, 10, 10, 10)]}>
            <ShimmerPlaceholder
              modifiers={[padding(0, 5, 0, 5)]}
              corner={8}
              shimmerColors={[backgroundColor]}
              height={16}
              width={textWidth}
              stopAutoRun={disableLoadingAnimations}
            />
            <ShimmerPlaceholder
              modifiers={[padding(0, 5, 0, 5)]}
              corner={8}
              shimmerColors={[backgroundColor]}
              height={16}
              width={textWidth}
              stopAutoRun={disableLoadingAnimations}
            />
            <ShimmerPlaceholder
              modifiers={[padding(0, 5, 0, 5)]}
              corner={8}
              shimmerColors={[backgroundColor]}
              height={16}
              width={textWidth * item.lastLineRatio}
              stopAutoRun={disableLoadingAnimations}
            />
          </Column>
        </Row>
      ))}
    </Column>
  );
};

export default memo(MalLoading);
