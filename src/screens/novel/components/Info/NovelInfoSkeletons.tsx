import { Box, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';

const useShimmer = (theme: ThemeColors) => {
  const [highlightColor, backgroundColor, disableLoadingAnimations] =
    useLoadingColors(theme);

  return {
    highlightColor,
    backgroundColor,
    disableLoadingAnimations,
  };
};

export const ChapterCountSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const shimmer = useShimmer(theme);

  return (
    <ShimmerPlaceholder
      shimmerColors={[shimmer.backgroundColor]}
      stopAutoRun={shimmer.disableLoadingAnimations}
      width={120}
      height={14}
      modifiers={[padding(16, 0, 16, 0)]}
    />
  );
};

export const NovelDetailsSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const shimmer = useShimmer(theme);

  return (
    <>
      {[130, 180].map((width, index) => (
        <Row key={index} modifiers={[padding(0, 0, 0, 8)]}>
          <ShimmerPlaceholder
            shimmerColors={[shimmer.backgroundColor]}
            stopAutoRun={shimmer.disableLoadingAnimations}
            width={width}
            height={14}
          />
        </Row>
      ))}
    </>
  );
};

export const ButtonGroupSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const shimmer = useShimmer(theme);

  return (
    <Row
      horizontalArrangement={{ spacedBy: 8 }}
      modifiers={[fillMaxWidth(), padding(16, 8, 16, 0)]}
    >
      {[0, 1].map(index => (
        <Box key={index} modifiers={[weight(1), height(52)]}>
          <ShimmerPlaceholder
            shimmerColors={[shimmer.backgroundColor]}
            stopAutoRun={shimmer.disableLoadingAnimations}
            height={52}
            corner={8}
            modifiers={[fillMaxWidth()]}
          />
        </Box>
      ))}
    </Row>
  );
};
