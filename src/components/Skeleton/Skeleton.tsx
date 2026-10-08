import { useTheme } from '@hooks/persisted';
import * as React from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
  weight,
  width,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';
import useLoadingColors from '@utils/useLoadingColors';
import { useShimmerModifier } from './ShimmerPlaceholder';

function useSetupLoadingAnimations() {
  const theme = useTheme();
  const [, backgroundColor, disableLoadingAnimations] = useLoadingColors(theme);
  const shimmer = useShimmerModifier(disableLoadingAnimations);

  return [shimmer, backgroundColor] as const;
}

const Bone = ({
  shimmer,
  color,
  corner = 4,
  modifiers,
}: {
  shimmer: ModifierConfig;
  color: string;
  corner?: number;
  modifiers: ModifierConfig[];
}) => (
  <Box
    modifiers={[
      ...modifiers,
      shimmer,
      clip(Shapes.RoundedCorner(corner)),
      background(color),
    ]}
  />
);

const ChapterSkeleton = React.memo(function ChapterSkeletonItem({
  shimmer,
  color,
  img,
}: {
  shimmer: ModifierConfig;
  color: string;
  img?: boolean;
}) {
  return (
    <Row
      verticalAlignment="center"
      modifiers={[fillMaxWidth(), padding(16, 8, 16, 8), height(56)]}
    >
      {img ? (
        <Bone
          shimmer={shimmer}
          color={color}
          modifiers={[padding(0, 0, 20, 0), size(40, 40)]}
        />
      ) : null}
      <Column verticalArrangement={{ spacedBy: 5 }} modifiers={[weight(1)]}>
        <Bone
          shimmer={shimmer}
          color={color}
          modifiers={[fillMaxWidth(), height(20)]}
        />
        <Bone
          shimmer={shimmer}
          color={color}
          modifiers={[fillMaxWidth(), height(15)]}
        />
      </Column>
      <Box modifiers={[padding(20, 0, 0, 0)]}>
        <Bone
          shimmer={shimmer}
          color={color}
          corner={20}
          modifiers={[size(30, 30)]}
        />
      </Box>
    </Row>
  );
});

function VerticalBarSkeleton() {
  const [shimmer, backgroundColor] = useSetupLoadingAnimations();
  return (
    <Box modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}>
      <Bone
        shimmer={shimmer}
        color={backgroundColor}
        modifiers={[fillMaxWidth(), height(24)]}
      />
    </Box>
  );
}

function NovelMetaSkeleton() {
  const [shimmer, backgroundColor] = useSetupLoadingAnimations();

  const chip = (
    <Bone
      shimmer={shimmer}
      color={backgroundColor}
      corner={8}
      modifiers={[width(80), height(30)]}
    />
  );

  return (
    <Column
      verticalArrangement={{ spacedBy: 5 }}
      modifiers={[fillMaxWidth(), padding(16, 13, 16, 2.5), height(110)]}
    >
      <Bone
        shimmer={shimmer}
        color={backgroundColor}
        modifiers={[fillMaxWidth(), height(20)]}
      />
      <Bone
        shimmer={shimmer}
        color={backgroundColor}
        modifiers={[fillMaxWidth(), height(20)]}
      />
      <Row
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[padding(0, 17, 0, 0)]}
      >
        {chip}
        {chip}
        {chip}
        {chip}
      </Row>
    </Column>
  );
}

const ChapterListSkeleton = ({ img }: { img?: boolean }) => {
  const [shimmer, backgroundColor] = useSetupLoadingAnimations();
  const skeletonItems = React.useMemo(() => Array.from({ length: 7 }), []);

  return (
    <Column modifiers={[fillMaxWidth()]}>
      {skeletonItems.map((_, i) => (
        <ChapterSkeleton
          key={i}
          shimmer={shimmer}
          color={backgroundColor}
          img={img}
        />
      ))}
    </Column>
  );
};

export { ChapterListSkeleton, NovelMetaSkeleton, VerticalBarSkeleton };
