import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyView } from '@components/index';
import NovelList, { NovelListRenderItem } from '@components/NovelList';
import LibraryNovelItem from './LibraryNovelItem';

import { History, NovelInfo } from '@database/types';

import { getString } from '@i18n/translations';
import { LibraryScreenProps } from '@navigators/types';
import { backgroundTasks } from '@services/backgroundTasks';
import { getPlugin } from '@plugins/pluginManager';
import { useSelectionContext } from '../SelectionContext';
import { ImageRequestInit } from '@plugins/types';
import ExploreIcon from '@expo/material-symbols/explore.xml';
import UploadFileIcon from '@expo/material-symbols/upload_file.xml';
import { useTheme } from '@hooks/persisted';

interface Props {
  categoryId: number;
  categoryName: string;
  novels: NovelInfo[];
  historyByNovelId: Map<number, History>;
  showContinueReadingButton: boolean;
  navigation: LibraryScreenProps['navigation'];
  pickAndImport: () => void;
  header?: React.ReactElement | null;
  availableWidth?: number;
  topPadding?: number;
}

export const LibraryView: React.FC<Props> = ({
  categoryId,
  categoryName,
  pickAndImport,
  navigation,
  novels,
  historyByNovelId,
  showContinueReadingButton,
  header,
  availableWidth,
  topPadding,
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

  const onContinueReading = useCallback(
    (item: NovelInfo, chapter: History) => {
      navigation.navigate('ReaderStack', {
        screen: 'Chapter',
        params: { novel: item, chapter },
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

  const extraData = useMemo(
    () => ({ selectedIdsSet, historyByNovelId }),
    [selectedIdsSet, historyByNovelId],
  );

  const renderItem = useCallback(
    ({ item }: { item: NovelInfo }) => (
      <LibraryNovelItem
        item={item}
        theme={theme}
        isSelected={selectedIdsSet.has(item.id)}
        hasSelection={hasSelection}
        onSelect={toggleSelection}
        onNavigate={onNavigate}
        onContinueReading={onContinueReading}
        lastReadChapter={historyByNovelId.get(item.id)}
        showContinueReadingButton={showContinueReadingButton}
        imageRequestInit={imageRequestInitMap.get(item.pluginId)}
      />
    ),
    [
      theme,
      selectedIdsSet,
      hasSelection,
      toggleSelection,
      onNavigate,
      onContinueReading,
      historyByNovelId,
      showContinueReadingButton,
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
        description={getString('libraryScreen.emptyCategory')}
        actions={[
          categoryId !== 2
            ? {
                iconName: ExploreIcon,
                title: getString('browse'),
                onPress: () => navigation.navigate('Browse'),
              }
            : {
                iconName: UploadFileIcon,
                title: getString('advancedSettingsScreen.importEpub'),
                onPress: pickAndImport,
              },
        ]}
      />
    ),
    [theme, categoryId, navigation, pickAndImport],
  );

  return (
    <View style={styles.flex}>
      <NovelList
        data={novels}
        extraData={extraData}
        renderItem={renderItem as NovelListRenderItem}
        ListEmptyComponent={listEmptyComponent}
        ListHeaderComponent={header}
        availableWidth={availableWidth}
        topPadding={topPadding}
        refreshing={false}
        onRefresh={onRefresh}
        bottomPadding={96}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
