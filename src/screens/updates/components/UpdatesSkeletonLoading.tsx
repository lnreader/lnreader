import React, { memo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';
import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';

const SKELETON_ITEMS = Array.from({ length: 8 });

interface Props {
  theme: ThemeColors;
}

const UpdatesSkeletonLoading: React.FC<Props> = ({ theme }) => {
  const { width } = useWindowDimensions();
  const textWidth = Math.max(80, width - 120);
  const [, backgroundColor, disableLoadingAnimations] = useLoadingColors(theme);

  const renderLoadingChapter = (_: unknown, index: number) => {
    return (
      <Row
        key={`updates-skeleton-${index}`}
        verticalAlignment="center"
        modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}
      >
        <ShimmerPlaceholder
          modifiers={[padding(16, 0, 16, 0)]}
          shimmerColors={[backgroundColor]}
          height={42}
          width={42}
          stopAutoRun={disableLoadingAnimations}
        />
        <Column modifiers={[weight(1)]}>
          <ShimmerPlaceholder
            modifiers={[padding(0, 5, 0, 2)]}
            corner={6}
            shimmerColors={[backgroundColor]}
            height={16}
            width={textWidth}
            stopAutoRun={disableLoadingAnimations}
          />
          <ShimmerPlaceholder
            modifiers={[padding(0, 2, 0, 5)]}
            corner={6}
            shimmerColors={[backgroundColor]}
            height={12}
            width={textWidth}
            stopAutoRun={disableLoadingAnimations}
          />
        </Column>
        <Box contentAlignment="center" modifiers={[size(45.1, 45.1)]}>
          <ShimmerPlaceholder
            corner={12.5}
            shimmerColors={[backgroundColor]}
            height={25}
            width={25}
            stopAutoRun={disableLoadingAnimations}
          />
        </Box>
      </Row>
    );
  };

  return (
    <Column modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}>
      {SKELETON_ITEMS.map(renderLoadingChapter)}
    </Column>
  );
};

export default memo(UpdatesSkeletonLoading);
