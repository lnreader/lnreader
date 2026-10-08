import { useEffect, useMemo, useState } from 'react';
import { padding } from '@expo/ui/jetpack-compose/modifiers';

import {
  AppText,
  ComposeSectionList,
  EmptyView,
  ErrorScreenV2,
  Screen,
  SearchbarV2,
} from '@components';
import HistoryCard from './components/HistoryCard/HistoryCard';

import { useSearch, useBoolean } from '@hooks';
import { useAppSettings, useTheme, useHistory } from '@hooks/persisted';

import { convertDateToISOString } from '@database/utils/convertDateToISOString';

import { History } from '@database/types';
import { getString } from '@i18n/translations';
import ClearHistoryDialog from './components/ClearHistoryDialog';
import HistorySkeletonLoading from './components/HistorySkeletonLoading';
import RemoveHistoryDialog from './components/RemoveHistoryDialog';
import { HistoryScreenProps } from '@navigators/types';
import { formatDate } from '@utils/dateFormat';
import DeleteSweepIcon from '@expo/material-symbols/delete_sweep.xml';
import SearchIcon from '@expo/material-symbols/search.xml';

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
    <Screen
      topBar={
        <SearchbarV2
          searchText={searchText}
          placeholder={getString('historyScreen.searchbar')}
          leftIcon={SearchIcon}
          onChangeText={onChangeText}
          clearSearchbar={clearSearchbar}
          rightIcons={[
            {
              iconName: DeleteSweepIcon,
              onPress: openClearHistoryDialog,
            },
          ]}
          theme={theme}
        />
      }
      list={
        isLoading || error ? undefined : (
          <ComposeSectionList
            sections={groupHistoryByDate(displayedHistory)}
            // Rows of all sections share one list, so keys need the id too.
            keyExtractor={(item, index) => 'history' + item.id + index}
            renderSectionHeader={({ section: { date } }) => (
              <AppText
                color={theme.onSurface}
                modifiers={[padding(16, 8, 16, 8)]}
              >
                {formatDate(date, dateFormat, relativeTimestamps)}
              </AppText>
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
        )
      }
      overlays={
        isLoading || error ? null : (
          <>
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
          </>
        )
      }
    >
      {isLoading ? (
        <HistorySkeletonLoading theme={theme} />
      ) : error ? (
        <ErrorScreenV2 error={error} />
      ) : null}
    </Screen>
  );
};

export default HistoryScreen;
