import React, { memo, useCallback, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { padding } from '@expo/ui/jetpack-compose/modifiers';

import {
  AppText,
  ComposeSectionList,
  EmptyView,
  ErrorScreenV2,
  Screen,
  SearchbarV2,
} from '@components';

import { useSearch } from '@hooks';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import UpdateNovelChapterGroup from './components/UpdateNovelChapterGroup';
import { deleteChapter } from '@database/queries/ChapterQueries';
import { showToast } from '@utils/showToast';
import { backgroundTasks } from '@services/backgroundTasks';
import { UpdateScreenProps } from '@navigators/types';
import { UpdateOverview } from '@database/types';
import { useUpdateContext } from '@components/Context/UpdateContext';
import { formatDate } from '@utils/dateFormat';
import { useFocusEffect } from '@react-navigation/native';
import RefreshIcon from '@expo/material-symbols/refresh.xml';
import SearchIcon from '@expo/material-symbols/search.xml';

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

  const sections = useMemo(
    () =>
      updatesOverview
        .filter(update =>
          searchText
            ? update.novelName.toLowerCase().includes(searchText.toLowerCase())
            : true,
        )
        .reduce(
          (
            groups: { data: UpdateOverview[]; date: string }[],
            update: UpdateOverview,
          ) => {
            if (
              groups.length === 0 ||
              groups[groups.length - 1]?.date !== update.updateDate
            ) {
              groups.push({ data: [update], date: update.updateDate });
              return groups;
            }
            groups[groups.length - 1]?.data.push(update);
            return groups;
          },
          [],
        ),
    [searchText, updatesOverview],
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
    <Screen
      topBar={
        <SearchbarV2
          searchText={searchText}
          clearSearchbar={clearSearchbar}
          placeholder={getString('updatesScreen.searchbar')}
          onChangeText={onChangeText}
          leftIcon={SearchIcon}
          theme={theme}
          rightIcons={[
            {
              iconName: RefreshIcon,
              onPress: () =>
                backgroundTasks.enqueue({ name: 'UPDATE_LIBRARY' }),
            },
          ]}
        />
      }
      list={
        error ? undefined : (
          <ComposeSectionList
            ListHeaderComponent={
              showLastUpdateTime && lastUpdateTime ? (
                <LastUpdateTime lastUpdateTime={lastUpdateTime} theme={theme} />
              ) : null
            }
            renderSectionHeader={({ section: { date } }) => (
              <AppText
                color={theme.onSurface}
                modifiers={[padding(16, 8, 16, 2)]}
              >
                {formatDate(date, dateFormat, relativeTimestamps)}
              </AppText>
            )}
            sections={sections}
            keyExtractor={item =>
              `updatedGroup-${item.novelId}-${item.updateDate}-${item.updatesPerDay}`
            }
            renderItem={({ item }) => (
              <UpdateNovelChapterGroup
                onDeleteChapter={chapter => {
                  deleteChapter(
                    chapter.pluginId,
                    chapter.novelId,
                    chapter.id,
                  ).then(() => {
                    showToast(
                      getString('common.deleted', {
                        name: chapter.name,
                      }),
                    );
                    getUpdates();
                  });
                }}
                overview={item}
                chapterCountLabel={getString('updatesScreen.updatesLower')}
              />
            )}
            ListEmptyComponent={
              <EmptyView
                icon="(˘･_･˘)"
                description={getString('updatesScreen.emptyView')}
                theme={theme}
              />
            }
            refreshing={false}
            onRefresh={() =>
              backgroundTasks.enqueue({ name: 'UPDATE_LIBRARY' })
            }
          />
        )
      }
    >
      {error ? <ErrorScreenV2 error={error} /> : null}
    </Screen>
  );
};

export default memo(UpdatesScreen);

const LastUpdateTime: React.FC<{
  lastUpdateTime: Date | number | string;
  theme: ThemeColors;
}> = ({ lastUpdateTime, theme }) => (
  <AppText
    variant="bodySmall"
    color={theme.onSurface}
    modifiers={[padding(16, 8, 16, 8)]}
    style={{ fontStyle: 'italic' }}
  >
    {`${getString('updatesScreen.lastUpdatedAt')} ${dayjs(
      lastUpdateTime,
    ).fromNow()}`}
  </AppText>
);
