import React, { memo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';
import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';

const SKELETON_ITEMS = Array.from({ length: 6 });

interface Props {
  width: number;
  height: number;
  theme: ThemeColors;
}

const CategorySkeletonLoading: React.FC<Props> = ({ height, width, theme }) => {
  const window = useWindowDimensions();
  const cardWidth = Math.min(width, window.width - 32);
  const [, backgroundColor, disableLoadingAnimations] = useLoadingColors(theme);

  const renderLoadingCard = (_: unknown, index: number) => {
    return (
      <ShimmerPlaceholder
        key={`category-skeleton-${index}`}
        modifiers={[padding(16, 0, 16, 0)]}
        corner={12}
        shimmerColors={[backgroundColor]}
        height={height}
        width={cardWidth}
        stopAutoRun={disableLoadingAnimations}
      />
    );
  };

  return (
    <Column
      verticalArrangement={{ spacedBy: 8 }}
      modifiers={[fillMaxWidth(), padding(0, 16, 0, 100)]}
    >
      {SKELETON_ITEMS.map(renderLoadingCard)}
    </Column>
  );
};

export default memo(CategorySkeletonLoading);
