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
  const [highlightColor, backgroundColor] = useLoadingColors(theme);

  const { displayMode = DisplayModes.Comfortable, novelsPerRow = 3 } =
    useLibrarySettings();

  const window = useWindowDimensions();
  const styles = createStyleSheet();

  const orientation = useDeviceOrientation();

  const numColumns = useMemo(
    () => (orientation === 'landscape' ? 6 : novelsPerRow),
    [orientation, novelsPerRow],
  );

  const [pictureHeight, pictureWidth] = useMemo(() => {
    const height = (window.width / numColumns) * (4 / 3);
    const width = (window.width - 12 - 9.6 * numColumns) / numColumns;
    return [height, width];
  }, [numColumns, window.width]);

  const renderLoadingNovel = (item: number) => {
    let randomNumber = Math.random();
    if (randomNumber < 0.1) {
      randomNumber = 0.1;
    }
    return (
      <View key={'sourceLoading' + item} style={{ flex: 1 / numColumns }}>
        <LoadingNovel
          backgroundColor={backgroundColor}
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

  if (displayMode === DisplayModes.List) {
    items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  } else {
    for (let i = 1; i * pictureHeight < window.height - 100; i++) {
      items.push(i);
    }
  }

  return <View style={styles.container}>{items.map(renderLoading)}</View>;
};

const createStyleSheet = () => {
  return StyleSheet.create({
    completeRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 8,
      opacity: 0.8,
      paddingHorizontal: 1,
      position: 'relative',
      right: 0,
    },
    container: {
      flexGrow: 1,
      marginBottom: 8,
      marginHorizontal: 2,
      marginTop: 2,
      overflow: 'visible',
    },
    row: {
      flexDirection: 'row',
      paddingHorizontal: 1,
    },
  });
};

export default memo(SourceScreenSkeletonLoading);
