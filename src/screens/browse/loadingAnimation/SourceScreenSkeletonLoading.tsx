import React, { memo, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';
import LoadingNovel from '@screens/browse/loadingAnimation/LoadingNovel';
import { useLibrarySettings } from '@hooks/persisted';
import { DisplayModes } from '@screens/library/constants/constants';
import { useDeviceOrientation } from '@hooks';

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

  const { displayMode = DisplayModes.Comfortable, novelsPerRow = 3 } =
    useLibrarySettings();

  const window = useWindowDimensions();
  const orientation = useDeviceOrientation();

  const numColumns = useMemo(
    () =>
      displayMode === DisplayModes.List
        ? 1
        : orientation === 'landscape'
        ? 6
        : novelsPerRow,
    [displayMode, orientation, novelsPerRow],
  );

  const [pictureHeight, pictureWidth] = useMemo(() => {
    const width = (window.width - 12 - 9.6 * numColumns) / numColumns;
    return [width * (4 / 3), width];
  }, [numColumns, window.width]);

  const renderLoadingNovel = (item: number) => {
    return (
      <View
        key={'sourceLoading' + item}
        style={[styles.item, { flex: 1 / numColumns }]}
      >
        <LoadingNovel
          availableWidth={window.width}
          backgroundColor={backgroundColor}
          disableLoadingAnimations={disableLoadingAnimations}
          highlightColor={highlightColor}
          pictureHeight={pictureHeight}
          pictureWidth={pictureWidth}
          displayMode={displayMode}
        />
      </View>
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
      <View key={'sourceSkeletonRow' + item} style={styles.row}>
        {items.map(renderLoadingNovel)}
      </View>
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

  return <View style={styles.container}>{items.map(renderLoading)}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    marginBottom: 8,
    marginHorizontal: 2,
    marginTop: 2,
    overflow: 'visible',
  },
  item: {
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 1,
  },
});

export default memo(SourceScreenSkeletonLoading);
