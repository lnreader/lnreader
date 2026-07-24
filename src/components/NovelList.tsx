import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  FlashList,
  type FlashListProps,
  type ListRenderItem,
} from '@shopify/flash-list';
import { NovelItem } from '@plugins/types';
import { NovelInfo } from '../database/types';
import { DisplayModes } from '@screens/library/constants/constants';
import {
  NovelCoverLayoutProvider,
  useNovelCoverLayoutValue,
} from './NovelCoverLayoutContext';

export type NovelListRenderItem = ListRenderItem<NovelInfo | NovelItem>;

export type NovelListDataItem = (NovelInfo | NovelItem) & {
  completeRow?: number;
};

interface NovelListProps
  extends Omit<FlashListProps<NovelInfo | NovelItem>, 'data'> {
  inSource?: boolean;
  data: NovelListDataItem[];
}

export const novelListKeyExtractor = (item: NovelInfo | NovelItem) =>
  'pluginId' in item ? `${item.pluginId}:${item.path}` : item.path;

export const extendNovelList = (
  data: NovelListDataItem[],
  inSource: boolean | undefined,
  numColumns: number,
) => {
  if (!data.length || !inSource) {
    return data;
  }

  const remainder = numColumns - (data.length % numColumns);
  const extension: NovelListDataItem[] = [];

  if (remainder !== 0 && remainder !== numColumns) {
    for (let index = 0; index < remainder; index += 1) {
      extension.push({
        id: undefined,
        cover: '',
        name: '',
        path: `__loading-filler-${index}`,
        completeRow: 1,
      });
    }
  }

  extension.push({
    id: undefined,
    cover: '',
    name: '',
    path: '__loading-row',
    completeRow: 2,
  });

  return [...data, ...extension];
};

const NovelList: React.FC<NovelListProps> = props => {
  const layout = useNovelCoverLayoutValue();
  const { displayMode, numColumns } = layout;
  const isListView = displayMode === DisplayModes.List;
  const { data, inSource, ...listProps } = props;

  const extendedNovelList = useMemo(
    () => extendNovelList(data, inSource, numColumns),
    [data, inSource, numColumns],
  );

  return (
    <NovelCoverLayoutProvider value={layout}>
      <FlashList
        contentContainerStyle={[
          !isListView && styles.listView,
          styles.flatListCont,
        ]}
        numColumns={numColumns}
        key={numColumns}
        keyExtractor={novelListKeyExtractor}
        {...listProps}
        data={extendedNovelList}
      />
    </NovelCoverLayoutProvider>
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
