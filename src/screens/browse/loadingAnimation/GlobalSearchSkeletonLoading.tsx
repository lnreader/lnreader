import React, { memo } from 'react';
import { Box, LazyRow } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxWidth,
  height,
  Shapes,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { COVER_ASPECT } from '@components';
import { GLOBAL_SEARCH_COVER_WIDTH } from '@components/NovelCoverLayoutContext';
import { ThemeColors } from '@theme/types';

interface Props {
  theme: ThemeColors;
}

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5];

const GlobalSearchSkeletonLoading: React.FC<Props> = ({ theme }) => (
  <LazyRow
    horizontalArrangement={{ spacedBy: 12 }}
    contentPadding={{ start: 16, end: 16 }}
    modifiers={[fillMaxWidth()]}
  >
    {SKELETON_ITEMS.map(index => (
      <Box
        key={index}
        modifiers={[
          width(GLOBAL_SEARCH_COVER_WIDTH),
          height(Math.round(GLOBAL_SEARCH_COVER_WIDTH * COVER_ASPECT)),
          clip(Shapes.RoundedCorner(12)),
          background(theme.surfaceContainerHigh ?? theme.surfaceVariant),
        ]}
      />
    ))}
  </LazyRow>
);

export default memo(GlobalSearchSkeletonLoading);
