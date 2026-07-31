import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  FlatList,
  ListRenderItem,
} from 'react-native';

import * as WebBrowser from 'expo-web-browser';

import { ErrorView } from '@components/ErrorView/ErrorView';
import { SafeAreaView, SearchbarV2 } from '@components';

import { showToast } from '@utils/showToast';
import DiscoverNovelCard from './DiscoverNovelCard';
import { useTheme, useTracker } from '@hooks/persisted';
import TrackerLoading from '../loadingAnimation/TrackerLoading';
import { queryAniList } from '@services/Trackers/aniList';
import localeData from 'dayjs/plugin/localeData';
import dayjs from 'dayjs';
import { BrowseALScreenProps } from '@navigators/types';

interface ALDate {
  month: number;
  year: number;
}

interface ALNovel {
  id: number;
  novelName: string;
  novelCover: string;
  score: string;
  info: string[];
}

dayjs.extend(localeData);

function formatDate(date: ALDate) {
  if (date.year && date.month) {
    return `${dayjs.monthsShort()[date.month - 1]} ${date.year}`;
  }

  return '';
}

function datesEqual(date1: ALDate, date2: ALDate) {
  return date1.year === date2.year && date1.month === date2.month;
}

const BrowseALScreen = ({ navigation }: BrowseALScreenProps) => {
  const theme = useTheme();
  const { tracker } = useTracker();

  const [loading, setLoading] = useState(true);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [novels, setNovels] = useState<ALNovel[]>([]);
  const [error, setError] = useState<string>();
  const [limit, setLimit] = useState(50);

  const [searchText, setSearchText] = useState('');

  const anilistSearchQuery = `query($search: String, $page: Int) {
    Page(page: $page) {
      pageInfo {
        hasNextPage
      }
      media(search: $search, type: MANGA, format: NOVEL, sort: POPULARITY_DESC) {
        id
        volumes
        title {
          userPreferred
        }
        coverImage {
          extraLarge
        }
        averageScore
        format
        startDate {
          month
          year
        }
        endDate {
          month
          year
        }
      }
    }
  }`;
  const anilistUrl =
    'https://anilist.co/search/manga?format=NOVEL&sort=POPULARITY_DESC';

  const searchAniList = useCallback(
    async (onlyTop: boolean, page = 1) => {
      const search = onlyTop ? undefined : searchText;
      let hasSearchNextPage;
      let results: ALNovel[] = [];
      try {
        if (!tracker) {
          setLoading(false);
          setError('Please login!');
          return;
        }
        const { data } = await queryAniList(
          anilistSearchQuery,
          {
            search,
            page,
          },
          tracker.auth,
        );
        hasSearchNextPage = data.Page.pageInfo.hasNextPage;
        results = data.Page.media.map((m: any) => {
          return {
            id: m.id,
            novelName: m.title.userPreferred,
            novelCover: m.coverImage.extraLarge,
            score: `${m.averageScore}%`,
            info: [
              '', // MAL returns an item we don't care about first, so the component ignores the first element
              `Light Novel (${m.volumes || '?'} Vols)`,
              `${formatDate(m.startDate)}${
                datesEqual(m.startDate, m.endDate)
                  ? ''
                  : `- ${formatDate(m.endDate)}`
              }`,
            ],
          };
        });
      } catch (err: any) {
        setError(err.message);
        setNovels([]);
        setLoading(false);
        showToast(err.message);
      }
      setHasNextPage(hasSearchNextPage);
      setNovels(onlyTop ? before => before.concat(results) : results);
      setLoading(false);
    },
    [anilistSearchQuery, searchText, tracker],
  );

  const clearSearchbar = () => {
    setNovels([]);
    setHasNextPage(true);
    searchAniList(true, 1);
    setLoading(true);
    setSearchText('');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    searchAniList(true);
  }, [searchAniList]);

  const renderItem: ListRenderItem<ALNovel> = ({ item }) => (
    <DiscoverNovelCard
      novel={item}
      theme={theme}
      onPress={() =>
        navigation.navigate('GlobalSearchScreen', {
          searchText: item.novelName,
        })
      }
    />
  );

  const ListEmptyComponent = useCallback(
    () => (
      <ErrorView
        errorName={error || 'No results found'}
        actions={[
          {
            name: 'Retry',
            onPress: () => {
              setLoading(true);
              setError(undefined);
              searchAniList(true);
            },
            icon: 'reload',
          },
        ]}
        theme={theme}
      />
    ),
    [error, searchAniList, theme],
  );

  return (
    <SafeAreaView>
      <SearchbarV2
        theme={theme}
        placeholder="Search AniList"
        leftIcon="arrow-left"
        handleBackAction={() => navigation.goBack()}
        searchText={searchText}
        onChangeText={text => setSearchText(text)}
        onSubmitEditing={() => searchAniList(false, 1)}
        clearSearchbar={clearSearchbar}
        rightIcons={[
          {
            iconName: 'earth',
            onPress: () => WebBrowser.openBrowserAsync(anilistUrl),
          },
        ]}
      />
      {loading ? (
        <TrackerLoading theme={theme} />
      ) : (
        <FlatList
          contentContainerStyle={styles.novelsContainer}
          data={novels}
          keyExtractor={item => item.id + '_' + item.novelName}
          renderItem={renderItem}
          ListEmptyComponent={ListEmptyComponent}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (hasNextPage && !searchText) {
              searchAniList(true, Math.ceil((limit + 50) / 50));
              setLimit(before => before + 50);
            }
          }}
          ListFooterComponent={
            !searchText ? (
              <View style={styles.paddingVertical}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

export default BrowseALScreen;

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  novelsContainer: {
    flexGrow: 1,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  paddingVertical: { paddingVertical: 16 },
});
