import React, { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyView } from '@components/index';
import NovelList, { NovelListRenderItem } from '@components/NovelList';
import LibraryNovelItem from './LibraryNovelItem';

import { NovelInfo } from '@database/types';

import { getString } from '@strings/translations';
import { useTheme } from '@hooks/persisted';
import { LibraryScreenProps } from '@navigators/types';
import { backgroundTasks } from '@services/backgroundTasks';
import { getPlugin } from '@plugins/pluginManager';
import { useSelectionContext } from '../SelectionContext';
import { ImageRequestInit } from '@plugins/types';

interface Props {
  categoryId: number;
  categoryName: string;
  novels: NovelInfo[];
  navigation: LibraryScreenProps['navigation'];
  pickAndImport: () => void;
}

export const LibraryView: React.FC<Props> = ({
  categoryId,
  categoryName,
  pickAndImport,
  navigation,
  novels,
}) => {
  const theme = useTheme();
  const { selectedIdsSet, hasSelection, toggleSelection } =
    useSelectionContext();

  const onNavigate = useCallback(
    (item: NovelInfo) => {
      navigation.navigate('ReaderStack', {
        screen: 'Novel',
        params: item,
      });
    },
    [navigation],
  );

  const imageRequestInitMap = useMemo(() => {
    const map = new Map<string, ImageRequestInit | undefined>();
    for (const novel of novels) {
      if (!map.has(novel.pluginId)) {
        map.set(novel.pluginId, getPlugin(novel.pluginId)?.imageRequestInit);
      }
    }
    return map;
  }, [novels]);

  const renderItem = useCallback(
    ({ item }: { item: NovelInfo }) => (
      <LibraryNovelItem
        item={item}
        theme={theme}
        isSelected={selectedIdsSet.has(item.id)}
        hasSelection={hasSelection}
        onSelect={toggleSelection}
        onNavigate={onNavigate}
        imageRequestInit={imageRequestInitMap.get(item.pluginId)}
      />
    ),
    [
      theme,
      selectedIdsSet,
      hasSelection,
      toggleSelection,
      onNavigate,
      imageRequestInitMap,
    ],
  );

  const onRefresh = useCallback(() => {
    if (categoryId === 2) {
      return;
    }
    backgroundTasks.enqueue({
      name: 'UPDATE_LIBRARY',
      data: { categoryId, categoryName },
    });
  }, [categoryId, categoryName]);

  const listEmptyComponent = useMemo(
    () => (
      <EmptyView
        theme={theme}
        icon="Σ(ಠ_ಠ)"
        description={getString('libraryScreen.empty')}
        actions={[
          categoryId !== 2
            ? {
                iconName: 'compass-outline',
                title: getString('browse'),
                onPress: () => navigation.navigate('Browse'),
              }
            : {
                iconName: 'book-arrow-up-outline',
                title: getString('advancedSettingsScreen.importEpub'),
                onPress: pickAndImport,
              },
        ]}
      />
    ),
    [theme, categoryId, navigation, pickAndImport],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={false}
        onRefresh={onRefresh}
        colors={[theme.onPrimary]}
        progressBackgroundColor={theme.primary}
      />
    ),
    [onRefresh, theme.onPrimary, theme.primary],
  );

  return (
    <View style={styles.flex}>
      <NovelList
        data={novels}
        extraData={selectedIdsSet}
        renderItem={renderItem as NovelListRenderItem}
        ListEmptyComponent={listEmptyComponent}
        refreshControl={refreshControl}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
