import { useLibrarySettings } from '@hooks/persisted';
import { DisplayModes } from '@screens/library/constants/constants';
import React, { useMemo } from 'react';
import {
  StyleSheet,
  FlatList,
  FlatListProps,
  ListRenderItem,
} from 'react-native';
import { NovelItem } from '@plugins/types';
import { NovelInfo } from '../database/types';
import { useDeviceOrientation } from '@hooks';

export type NovelListRenderItem = ListRenderItem<NovelInfo | NovelItem>;

type listDataItem =
  | (NovelInfo | NovelItem) & {
      completeRow?: number;
    };

interface NovelListProps extends FlatListProps<NovelInfo | NovelItem> {
  inSource?: boolean;
  data: listDataItem[];
}

const novelListKeyExtractor = (item: NovelInfo | NovelItem, index: number) =>
  index + '_' + item.path;

const NovelList: React.FC<NovelListProps> = props => {
  const { displayMode = DisplayModes.Comfortable, novelsPerRow = 3 } =
    useLibrarySettings();
  const orientation = useDeviceOrientation();

  const isListView = displayMode === DisplayModes.List;

  const numColumns = useMemo(() => {
    if (isListView) {
      return 1;
    }

    if (orientation === 'landscape') {
      return 6;
    } else {
      return novelsPerRow;
    }
  }, [isListView, orientation, novelsPerRow]);

  let extendedNovelList: listDataItem[] = props?.data;
  if (props.data?.length && props.inSource) {
    const remainder = numColumns - (props.data?.length % numColumns);
    const extension: listDataItem[] = [];
    if (remainder !== 0 && remainder !== numColumns) {
      for (let i = 0; i < remainder; i++) {
        extension.push({
          cover: '',
          name: '',
          path: 'loading-' + remainder,
          completeRow: 1,
        } as listDataItem);
      }
    }
    extension.push({
      cover: '',
      name: '',
      path: 'loading-' + remainder,
      completeRow: 2,
    } as listDataItem);

    extendedNovelList = [...props.data, ...extension];
  }

  return (
    <FlatList
      contentContainerStyle={[
        !isListView && styles.listView,
        styles.flatListCont,
      ]}
      numColumns={numColumns}
      key={numColumns}
      keyExtractor={novelListKeyExtractor}
      {...props}
      data={extendedNovelList}
    />
  );
};

export default NovelList;

const styles = StyleSheet.create({
  flatListCont: {
    flexGrow: 1,
    paddingBottom: 56,
  },
  listView: {
    paddingHorizontal: 4,
  },
});
