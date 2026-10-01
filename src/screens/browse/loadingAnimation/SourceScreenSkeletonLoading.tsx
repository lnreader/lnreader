import React, { memo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';
import LoadingNovel from '@screens/browse/loadingAnimation/LoadingNovel';
import { DisplayModes } from '@screens/library/constants/constants';
import {
  GRID_PADDING,
  GRID_SPACING,
  useNovelCoverLayoutValue,
} from '@components/NovelCoverLayoutContext';

interface Props {
  theme: ThemeColors;
  completeRow?: number;
}

const SourceScreenSkeletonLoading: React.FC<Props> = ({
  theme,
  completeRow,
}) => {
  const [highlightColor, backgroundColor, disableLoadingAnimations] =
    useLoadingColors(theme);

  const window = useWindowDimensions();
  // Sized like the novel grid it stands in for.
  const {
    displayMode,
    numColumns,
    coverWidth: pictureWidth,
    coverHeight: pictureHeight,
  } = useNovelCoverLayoutValue();

  const renderLoadingNovel = (item: number) => {
    return (
      <Box key={'sourceLoading' + item} modifiers={[weight(1)]}>
        <LoadingNovel
          availableWidth={window.width}
          backgroundColor={backgroundColor}
          disableLoadingAnimations={disableLoadingAnimations}
          highlightColor={highlightColor}
          pictureHeight={pictureHeight}
          pictureWidth={pictureWidth}
          displayMode={displayMode}
        />
      </Box>
    );
  };
  const renderLoading = (item: number) => {
    const offset = Math.pow(10, item);
    const items: number[] = [1 * offset];
    if (displayMode !== DisplayModes.List) {
      for (let i = 2; i <= numColumns; i++) {
        items.push(i * offset);
      }
    }
    return (
      <Row
        key={'sourceSkeletonRow' + item}
        horizontalArrangement={{ spacedBy: GRID_SPACING }}
        modifiers={[fillMaxWidth()]}
      >
        {items.map(renderLoadingNovel)}
      </Row>
    );
  };
  let items: number[] = [];
  if (completeRow === 1) {
    return renderLoadingNovel(completeRow);
  }

  // completeRow === 2: a single full-width trailing row (rendered as the
  // list footer), not a screen-filling grid.
  if (completeRow === 2) {
    items = [1];
  } else if (displayMode === DisplayModes.List) {
    items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  } else {
    for (let i = 1; i * pictureHeight < window.height - 100; i++) {
      items.push(i);
    }
  }

  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        padding(GRID_PADDING, completeRow === 2 ? 0 : 4, GRID_PADDING, 8),
      ]}
    >
      {items.map(renderLoading)}
    </Column>
  );
};

export default memo(SourceScreenSkeletonLoading);
