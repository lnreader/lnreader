import React, { useMemo, type Ref } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { NovelItem } from '@plugins/types';
import { NovelInfo } from '../database/types';
import { DisplayModes } from '@screens/library/constants/constants';
import { chunk, GridRow } from './ComposeList/GridRow';
import { ComposeList, type ComposeListHandle } from './ComposeList/ComposeList';
import {
  GRID_PADDING,
  GRID_SPACING,
  NovelCoverLayoutProvider,
  useNovelCoverLayoutValue,
} from './NovelCoverLayoutContext';

export type NovelListRenderItem = (info: {
  item: NovelInfo | NovelItem;
  index: number;
}) => React.ReactNode;

export type NovelListDataItem = (NovelInfo | NovelItem) & {
  completeRow?: number;
};

interface NovelListProps {
  inSource?: boolean;
  data: NovelListDataItem[];
  renderItem: NovelListRenderItem;
  keyExtractor?: (item: NovelInfo | NovelItem) => string;
  extraData?: unknown;
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  onEndReached?: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Width the list lays out in, when narrower than the window. */
  availableWidth?: number;
  listRef?: Ref<ComposeListHandle>;
  topPadding?: number;
  bottomPadding?: number;
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

  return [...data, ...extension];
};

const NovelList: React.FC<NovelListProps> = props => {
  const layout = useNovelCoverLayoutValue(false, props.availableWidth);
  const { displayMode, numColumns } = layout;
  const isListView = displayMode === DisplayModes.List;
  const {
    data,
    inSource,
    renderItem,
    keyExtractor = novelListKeyExtractor,
    extraData,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent,
    onEndReached,
    onScroll,
    refreshing,
    onRefresh,
    listRef,
    topPadding,
    bottomPadding = 56,
  } = props;

  const extendedNovelList = useMemo(
    () => extendNovelList(data, inSource, numColumns),
    [data, inSource, numColumns],
  );
  // Each Compose row is hosted on its own, so the grid is laid out in rows.
  const rows = useMemo(
    () => chunk(extendedNovelList, numColumns),
    [extendedNovelList, numColumns],
  );
  const footer = extendedNovelList.length
    ? ListFooterComponent
    : ListEmptyComponent;

  return (
    <NovelCoverLayoutProvider value={layout}>
      {isListView ? (
        <ComposeList
          ref={listRef}
          data={extendedNovelList}
          extraData={extraData}
          keyExtractor={item => keyExtractor(item)}
          renderItem={(item, index) => renderItem({ item, index })}
          header={ListHeaderComponent}
          footer={footer}
          onEndReached={onEndReached}
          onScroll={onScroll}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentPadding={{ top: topPadding, bottom: bottomPadding }}
        />
      ) : (
        <ComposeList
          ref={listRef}
          data={rows}
          extraData={extraData}
          // Rows are positional: keep them mounted and let cells update.
          keyExtractor={(_row, index) => `row-${index}`}
          renderItem={(row, rowIndex) => (
            <GridRow
              items={row}
              columns={numColumns}
              spacing={GRID_SPACING}
              keyExtractor={item => keyExtractor(item)}
              renderCell={item =>
                renderItem({
                  item,
                  index: rowIndex * numColumns + row.indexOf(item),
                })
              }
            />
          )}
          header={ListHeaderComponent}
          footer={footer}
          onEndReached={onEndReached}
          onScroll={onScroll}
          refreshing={refreshing}
          onRefresh={onRefresh}
          verticalSpacing={GRID_SPACING}
          estimatedItemSize={layout.coverHeight}
          contentPadding={{
            top: topPadding ?? 4,
            bottom: bottomPadding,
            horizontal: GRID_PADDING,
          }}
        />
      )}
    </NovelCoverLayoutProvider>
  );
};

export default NovelList;
