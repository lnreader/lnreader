import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, Text } from 'react-native';

import {
  EmptyView,
  ErrorScreenV2,
  SearchbarV2,
  SafeAreaView,
} from '@components';

import { useSearch } from '@hooks';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import GroupedChapterList, {
  type ChapterGroupSection,
  toggleChapterGroup,
} from '@components/GroupedChapterList/GroupedChapterList';
import {
  updateGroupKey,
  useGroupedUpdateChapters,
} from './useGroupedUpdateChapters';
import { deleteChapter } from '@database/queries/ChapterQueries';
import { showToast } from '@utils/showToast';
import { backgroundTasks } from '@services/backgroundTasks';
import { UpdateScreenProps } from '@navigators/types';
import type { Update } from '@database/types';
import { useUpdateContext } from '@components/Context/UpdateContext';
import { formatDate } from '@utils/dateFormat';
import { useFocusEffect } from '@react-navigation/native';

const UpdatesScreen = ({ navigation }: UpdateScreenProps) => {
  const theme = useTheme();
  const { dateFormat = 'default', relativeTimestamps = true } =
    useAppSettings();
  const {
    updatesOverview,
    getUpdates,
    lastUpdateTime,
    showLastUpdateTime,
    error,
  } = useUpdateContext();
  const { searchText, setSearchText, clearSearchbar } = useSearch();
  const onChangeText = (text: string) => {
    setSearchText(text);
  };

  useFocusEffect(
    useCallback(() => {
      void getUpdates();
    }, [getUpdates]),
  );

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const details = useGroupedUpdateChapters(updatesOverview, expanded);
  const sections = useMemo(() => {
    const groups: ChapterGroupSection[] = [];
    const search = searchText.toLowerCase();
    for (const update of updatesOverview) {
      if (search && !update.novelName.toLowerCase().includes(search)) {
        continue;
      }
      let section = groups.at(-1);
      if (!section || section.key !== update.updateDate) {
        section = {
          key: update.updateDate,
          title: formatDate(update.updateDate, dateFormat, relativeTimestamps),
          groups: [],
        };
        groups.push(section);
      }
      const key = updateGroupKey(update.novelId, update.updateDate);
      section.groups.push({
        key,
        count: update.updatesPerDay,
        chapters: details.get(key),
        novel: {
          id: update.novelId,
          pluginId: update.pluginId,
          name: update.novelName,
          path: update.novelPath,
          cover: update.novelCover,
          inLibrary: update.inLibrary,
        },
      });
    }
    return groups;
  }, [dateFormat, details, relativeTimestamps, searchText, updatesOverview]);

  const onDeleteChapter = useCallback(
    async (chapter: Update) => {
      try {
        await deleteChapter(chapter.pluginId, chapter.novelId, chapter.id);
        showToast(getString('common.deleted', { name: chapter.name }));
      } catch (deleteError) {
        showToast(
          deleteError instanceof Error
            ? deleteError.message
            : getString('novelScreen.deleteChapterError'),
        );
      } finally {
        await getUpdates();
      }
    },
    [getUpdates],
  );

  useEffect(
    () =>
      navigation.addListener('tabPress', e => {
        if (navigation.isFocused()) {
          e.preventDefault();

          navigation.navigate('MoreStack', {
            screen: 'TaskQueue',
          });
        }
      }),
    [navigation],
  );

  return (
    <SafeAreaView excludeBottom>
      <SearchbarV2
        searchText={searchText}
        clearSearchbar={clearSearchbar}
        placeholder={getString('updatesScreen.searchbar')}
        onChangeText={onChangeText}
        leftIcon="magnify"
        theme={theme}
        rightIcons={[
          {
            iconName: 'reload',
            onPress: () => backgroundTasks.enqueue({ name: 'UPDATE_LIBRARY' }),
          },
        ]}
      />
      {error ? (
        <ErrorScreenV2 error={error} />
      ) : (
        <GroupedChapterList
          theme={theme}
          sections={sections}
          expanded={expanded}
          onToggleGroup={key =>
            setExpanded(previous => toggleChapterGroup(previous, key))
          }
          countLabel={getString('updatesScreen.updatesLower')}
          onDeleteChapter={onDeleteChapter}
          onRefresh={() => backgroundTasks.enqueue({ name: 'UPDATE_LIBRARY' })}
          header={
            showLastUpdateTime && lastUpdateTime ? (
              <LastUpdateTime lastUpdateTime={lastUpdateTime} theme={theme} />
            ) : null
          }
          empty={
            <EmptyView
              icon="(˘･_･˘)"
              description={getString('updatesScreen.emptyView')}
              theme={theme}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default memo(UpdatesScreen);

const LastUpdateTime: React.FC<{
  lastUpdateTime: Date | number | string;
  theme: ThemeColors;
}> = ({ lastUpdateTime, theme }) => (
  <Text style={[styles.lastUpdateTime, { color: theme.onSurface }]}>
    {`${getString('updatesScreen.lastUpdatedAt')} ${dayjs(
      lastUpdateTime,
    ).fromNow()}`}
  </Text>
);

const styles = StyleSheet.create({
  lastUpdateTime: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
