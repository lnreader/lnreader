import { useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, SectionList, Text } from 'react-native';

import {
  EmptyView,
  ErrorScreenV2,
  SafeAreaView,
  SearchbarV2,
} from '@components';
import HistoryCard from './components/HistoryCard/HistoryCard';
import PurgeHistoryDialog from './components/PurgeHistoryDialog';

import { useSearch, useBackHandler, useBoolean } from '@hooks';
import { useAppSettings, useTheme, useHistory } from '@hooks/persisted';

import { convertDateToISOString } from '@database/utils/convertDateToISOString';
import { getNovelDownloadedChapters } from '@database/queries/ChapterQueries';

import { History } from '@database/types';
import { getString } from '@i18n/translations';
import ClearHistoryDialog from './components/ClearHistoryDialog';
import HistorySkeletonLoading from './components/HistorySkeletonLoading';
import RemoveHistoryDialog from './components/RemoveHistoryDialog';
import { HistoryScreenProps } from '@navigators/types';
import { formatDate } from '@utils/dateFormat';
import xor from 'lodash-es/xor';
import { Portal } from 'react-native-paper';
import { Actionbar } from '@components/Actionbar/Actionbar';
import { useHistoryPurge } from './hooks/useHistoryPurge';
import { HistorySelectionContext } from './HistorySelectionContext';

const HistoryScreen = ({ navigation }: HistoryScreenProps) => {
  const theme = useTheme();
  const { dateFormat = 'default', relativeTimestamps = true } =
    useAppSettings();
  const {
    isLoading,
    history,
    clearAllHistory,
    removeChapterFromHistory,
    removeNovelFromHistory,
    error,
  } = useHistory();

  const { searchText, setSearchText, clearSearchbar } = useSearch();
  const [historyToRemove, setHistoryToRemove] = useState<History>();

  // --- Bulk selection (#1874): long-press a card to enter select mode ---
  const [selectedNovelIds, setSelectedNovelIds] = useState<number[]>([]);
  const selectedIdsSet = useMemo(
    () => new Set(selectedNovelIds),
    [selectedNovelIds],
  );
  const hasSelection = selectedNovelIds.length > 0;
  const toggleSelection = useCallback(
    (id: number) => setSelectedNovelIds(prev => xor(prev, [id])),
    [],
  );
  const selectionContextValue = useMemo(
    () => ({
      selectedIdsSet,
      hasSelection,
      toggleSelection,
      setSelectedNovelIds,
    }),
    [selectedIdsSet, hasSelection, toggleSelection],
  );

  useBackHandler(() => {
    if (hasSelection) {
      setSelectedNovelIds([]);
      return true;
    }
    return false;
  });

  const selectedEntries = useMemo(
    () => history.filter(item => selectedIdsSet.has(item.novelId)),
    [history, selectedIdsSet],
  );

  const {
    value: purgeDialogVisible,
    setTrue: openPurgeDialog,
    setFalse: closePurgeDialog,
  } = useBoolean();

  const { purgeNovels } = useHistoryPurge();

  // Live downloaded-chapter count for the confirm dialog (review R3):
  // fetched from the DB when the dialog opens, not from stale row data.
  const [purgeChapterCount, setPurgeChapterCount] = useState(0);

  const openPurgeDialogWithCounts = useCallback(async () => {
    let total = 0;
    for (const entry of selectedEntries) {
      try {
        const downloaded = await getNovelDownloadedChapters(entry.novelId);
        total += downloaded.length;
      } catch {
        // Counting is best-effort; the purge itself re-resolves and
        // isolates per-novel errors.
      }
    }
    setPurgeChapterCount(total);
    openPurgeDialog();
  }, [selectedEntries, openPurgeDialog]);

  const handlePurge = useCallback(async () => {
    await purgeNovels(selectedEntries);
    setSelectedNovelIds([]);
    setPurgeChapterCount(0);
  }, [purgeNovels, selectedEntries]);

  const actionbarActions = useMemo(
    () => [
      {
        icon: 'delete-outline' as const,
        onPress: () => {
          void openPurgeDialogWithCounts();
        },
      },
      {
        icon: 'close' as const,
        onPress: () => {
          setSelectedNovelIds([]);
        },
      },
    ],
    [openPurgeDialogWithCounts],
  );

  const onChangeText = (text: string) => {
    setSearchText(text);
  };

  const displayedHistory = useMemo(
    () =>
      searchText
        ? history.filter(item =>
            item.novelName.toLowerCase().includes(searchText.toLowerCase()),
          )
        : history,
    [history, searchText],
  );

  const groupHistoryByDate = (rawHistory: History[]) => {
    const dateGroups = rawHistory.reduce<Record<string, History[]>>(
      (groups, item) => {
        if (!item.readTime) return groups;
        const date = convertDateToISOString(item.readTime);

        if (!groups[date]) {
          groups[date] = [];
        }

        groups[date].push(item);

        return groups;
      },
      {},
    );

    const groupedHistory = Object.keys(dateGroups).map(date => {
      return {
        date,
        data: dateGroups[date],
      };
    });

    return groupedHistory;
  };

  const {
    value: clearHistoryDialogVisible,
    setTrue: openClearHistoryDialog,
    setFalse: closeClearHistoryDialog,
  } = useBoolean();

  const removeHistory = async (resetAllChapters: boolean) => {
    if (!historyToRemove) return;

    if (resetAllChapters) {
      await removeNovelFromHistory(historyToRemove.novelId);
    } else {
      await removeChapterFromHistory(historyToRemove.id);
    }
  };

  useEffect(
    () =>
      navigation.addListener('tabPress', e => {
        const lastNovel = history[0];
        if (navigation.isFocused() && lastNovel) {
          e.preventDefault();

          navigation.navigate('ReaderStack', {
            screen: 'Novel',
            params: {
              name: lastNovel.novelName,
              path: lastNovel.novelPath,
              cover: lastNovel.novelCover,
              pluginId: lastNovel.pluginId,
              inLibrary: lastNovel.inLibrary,
            },
          });
        }
      }),
    [navigation, history],
  );

  return (
    <HistorySelectionContext.Provider value={selectionContextValue}>
      <SafeAreaView excludeBottom>
        <SearchbarV2
          searchText={searchText}
          placeholder={getString('historyScreen.searchbar')}
          leftIcon="magnify"
          onChangeText={onChangeText}
          clearSearchbar={clearSearchbar}
          rightIcons={[
            {
              iconName: 'delete-sweep-outline',
              onPress: openClearHistoryDialog,
            },
          ]}
          theme={theme}
        />
        {isLoading ? (
          <HistorySkeletonLoading theme={theme} />
        ) : error ? (
          <ErrorScreenV2 error={error} />
        ) : (
          <>
            <SectionList
              contentContainerStyle={styles.listContainer}
              sections={groupHistoryByDate(displayedHistory)}
              keyExtractor={(item, index) => 'history' + index}
              renderSectionHeader={({ section: { date } }) => (
                <Text style={[styles.dateHeader, { color: theme.onSurface }]}>
                  {formatDate(date, dateFormat, relativeTimestamps)}
                </Text>
              )}
              renderItem={({ item }) => (
                <HistoryCard history={item} onRemove={setHistoryToRemove} />
              )}
              ListEmptyComponent={
                <EmptyView
                  icon="(˘･_･˘)"
                  description={getString('historyScreen.nothingReadRecently')}
                  theme={theme}
                />
              }
            />
            <ClearHistoryDialog
              visible={clearHistoryDialogVisible}
              onSubmit={clearAllHistory}
              onDismiss={closeClearHistoryDialog}
            />
            <RemoveHistoryDialog
              visible={Boolean(historyToRemove)}
              onSubmit={removeHistory}
              onDismiss={() => setHistoryToRemove(undefined)}
            />
            <PurgeHistoryDialog
              visible={purgeDialogVisible}
              novelCount={selectedEntries.length}
              libraryNovelCount={
                selectedEntries.filter(entry => entry.inLibrary).length
              }
              chapterCount={purgeChapterCount}
              onSubmit={handlePurge}
              onDismiss={closePurgeDialog}
            />
            <Portal>
              <Actionbar active={hasSelection} actions={actionbarActions} />
            </Portal>
          </>
        )}
      </SafeAreaView>
    </HistorySelectionContext.Provider>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listContainer: {
    flexGrow: 1,
  },
});
