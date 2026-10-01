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

const SKELETON_ITEMS = [
  { dateWidth: 72 },
  { dateWidth: null },
  { dateWidth: null },
  { dateWidth: 88 },
  { dateWidth: null },
] as const;

interface Props {
  theme: ThemeColors;
}

const HistorySkeletonLoading: React.FC<Props> = ({ theme }) => {
  const { width } = useWindowDimensions();
  const textWidth = Math.max(80, width - 144);
  const [, backgroundColor, disableLoadingAnimations] = useLoadingColors(theme);

  const renderLoadingChapter = (
    { dateWidth }: (typeof SKELETON_ITEMS)[number],
    index: number,
  ) => (
    <Column key={`historyLoading${index}`} modifiers={[fillMaxWidth()]}>
      {dateWidth ? (
        <ShimmerPlaceholder
          modifiers={[padding(16, 8, 16, 8)]}
          corner={6}
          shimmerColors={[backgroundColor]}
          height={19.3}
          width={dateWidth}
          stopAutoRun={disableLoadingAnimations}
        />
      ) : null}
      <Row
        verticalAlignment="center"
        modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}
      >
        <ShimmerPlaceholder
          modifiers={[padding(16, 0, 16, 0)]}
          shimmerColors={[backgroundColor]}
          height={80}
          width={56}
          stopAutoRun={disableLoadingAnimations}
        />
        <Column modifiers={[weight(1), padding(0, 5, 0, 2)]}>
          <ShimmerPlaceholder
            modifiers={[padding(0, 0, 0, 4)]}
            corner={6}
            shimmerColors={[backgroundColor]}
            height={16}
            width={textWidth}
            stopAutoRun={disableLoadingAnimations}
          />
          <ShimmerPlaceholder
            modifiers={[padding(0, 0, 0, 4)]}
            corner={6}
            shimmerColors={[backgroundColor]}
            height={12}
            width={textWidth}
            stopAutoRun={disableLoadingAnimations}
          />
        </Column>
        <Box contentAlignment="center" modifiers={[size(40, 40)]}>
          <ShimmerPlaceholder
            corner={12.5}
            shimmerColors={[backgroundColor]}
            height={24}
            width={24}
            stopAutoRun={disableLoadingAnimations}
          />
        </Box>
      </Row>
    </Column>
  );

  return (
    <Column modifiers={[fillMaxWidth()]}>
      {SKELETON_ITEMS.map(renderLoadingChapter)}
    </Column>
  );
};

export default memo(HistorySkeletonLoading);
