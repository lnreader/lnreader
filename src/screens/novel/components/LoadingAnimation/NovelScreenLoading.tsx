import React, { createContext, memo, useContext, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  fillMaxWidth,
  padding,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppHost } from '@components';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';
import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';

interface Props {
  theme: ThemeColors;
}

interface SkeletonContextValue {
  backgroundColor: string;
  disableLoadingAnimations: boolean;
  fullWidth: number;
  highlightColor: string;
}

const SkeletonContext = createContext<SkeletonContextValue | null>(null);

const useSkeletonContext = () => {
  const value = useContext(SkeletonContext);
  if (!value) {
    throw new Error('Loading skeleton must be rendered inside SkeletonContext');
  }
  return value;
};

const DESCRIPTION_LINES = Array.from({ length: 2 });
const CHIP_WIDTHS = [64, 88, 52, 72];
const STAT_ITEMS = Array.from({ length: 3 });
const CHAPTER_ITEMS = Array.from({ length: 7 });

export const LoadingShimmer = memo(
  ({
    modifiers,
    height,
    width,
    corner = 8,
    visible = true,
  }: {
    modifiers?: ModifierConfig[];
    height: number;
    width: number;
    corner?: number;
    visible?: boolean;
  }) => {
    const { backgroundColor, disableLoadingAnimations } = useSkeletonContext();
    if (!visible) {
      return null;
    }

    return (
      <ShimmerPlaceholder
        modifiers={modifiers}
        shimmerColors={[backgroundColor]}
        height={height}
        width={width}
        corner={corner}
        stopAutoRun={disableLoadingAnimations}
      />
    );
  },
);

const text = padding(0, 5, 0, 0);

const NovelTop = memo(() => {
  const { fullWidth } = useSkeletonContext();
  const textWidth = Math.max(80, fullWidth - 116);
  return (
    <Row
      horizontalArrangement="spaceEvenly"
      modifiers={[fillMaxWidth(), padding(0, 118, 0, 0)]}
    >
      <LoadingShimmer height={150} width={100} />
      <Column modifiers={[padding(0, 30, 0, 0)]}>
        <LoadingShimmer modifiers={[text]} height={25} width={textWidth} />
        <LoadingShimmer modifiers={[text]} height={20} width={textWidth} />
        <LoadingShimmer modifiers={[text]} height={20} width={textWidth} />
      </Column>
    </Row>
  );
});

export const LoadingDescription = memo(() => {
  const { fullWidth } = useSkeletonContext();
  return (
    <Column modifiers={[padding(16, 8, 16, 16)]}>
      {DESCRIPTION_LINES.map((_, index) => (
        <LoadingShimmer
          key={`description-skeleton-${index}`}
          modifiers={[text]}
          height={16}
          width={fullWidth}
        />
      ))}
    </Column>
  );
});

export const LoadingChips = memo(() => (
  <Row
    horizontalArrangement={{ spacedBy: 8 }}
    modifiers={[padding(16, 0, 16, 6)]}
  >
    {CHIP_WIDTHS.map((width, index) => (
      <LoadingShimmer
        key={`chip-skeleton-${index}`}
        height={32}
        width={width}
      />
    ))}
  </Row>
));

const NovelInformation = memo(() => (
  <Column modifiers={[fillMaxWidth(), padding(0, 4, 0, 4)]}>
    <Row
      horizontalArrangement="spaceAround"
      modifiers={[fillMaxWidth(), padding(0, 4, 0, 4)]}
    >
      {STAT_ITEMS.map((_, index) => (
        <LoadingShimmer
          key={`stat-skeleton-${index}`}
          corner={30}
          height={56}
          width={90}
        />
      ))}
    </Row>
    <LoadingDescription />
    <LoadingChips />
  </Column>
));

export const LoadingChapterItem = memo(() => {
  const { fullWidth } = useSkeletonContext();
  const textWidth = Math.max(80, fullWidth - 50);
  return (
    <Row verticalAlignment="center" modifiers={[padding(16, 8, 16, 8)]}>
      <Column>
        <LoadingShimmer modifiers={[text]} height={20} width={textWidth} />
        <LoadingShimmer modifiers={[text]} height={16} width={textWidth} />
      </Column>
      <LoadingShimmer
        modifiers={[padding(20, 0, 0, 0)]}
        corner={20}
        height={30}
        width={30}
      />
    </Row>
  );
});

const Chapters = memo(() => {
  const { fullWidth } = useSkeletonContext();
  return (
    <Column>
      <LoadingShimmer
        modifiers={[padding(16, 5, 16, 5)]}
        height={30}
        width={fullWidth}
      />
      {CHAPTER_ITEMS.map((_, index) => (
        <LoadingChapterItem key={`chapter-skeleton-${index}`} />
      ))}
    </Column>
  );
});

const NovelScreenLoading: React.FC<Props> = ({ theme }) => {
  const { width } = useWindowDimensions();
  const [highlightColor, backgroundColor, disableLoadingAnimations] =
    useLoadingColors(theme);
  const contextValue = useMemo(
    () => ({
      backgroundColor,
      disableLoadingAnimations,
      fullWidth: Math.max(160, width - 32),
      highlightColor,
    }),
    [backgroundColor, disableLoadingAnimations, highlightColor, width],
  );

  return (
    <SkeletonContext.Provider value={contextValue}>
      <AppHost style={styles.container}>
        <Column modifiers={[fillMaxSize(), padding(0, 0, 0, 8)]}>
          <NovelTop />
          <NovelInformation />
          <Chapters />
        </Column>
      </AppHost>
    </SkeletonContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    overflow: 'hidden',
  },
});

export default memo(NovelScreenLoading);
