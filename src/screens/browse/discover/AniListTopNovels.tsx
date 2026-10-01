import { useCallback, useEffect, useMemo, useState } from 'react';

import * as WebBrowser from 'expo-web-browser';

import { ErrorView } from '@components/ErrorView/ErrorView';
import {
  ComposeList,
  LoadingMoreIndicator,
  Screen,
  SearchbarV2,
} from '@components';
import PublicIcon from '@expo/material-symbols/public.xml';
import RefreshIcon from '@expo/material-symbols/refresh.xml';

import { showToast } from '@utils/showToast';
import DiscoverNovelCard from './DiscoverNovelCard';
import { useTheme, useTracker } from '@hooks/persisted';
import { queryAniList } from '@services/Trackers/aniList';
import localeData from 'dayjs/plugin/localeData';
import dayjs from 'dayjs';
import TrackerLoading from '../loadingAnimation/TrackerLoading';
import { BrowseALScreenProps } from '@navigators/types';
import ArrowBackIcon from '@expo/material-symbols/arrow_back.xml';

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
      try {
        if (!tracker) {
          setLoading(false);
          setError('Please login!');
          return;
        }
        const { data } = await queryAniList(
          anilistSearchQuery,
          {
            search: onlyTop ? undefined : searchText,
            page,
          },
          tracker.auth,
        );

        const results = data.Page.media.map((m: any) => {
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

        setHasNextPage(data.Page.pageInfo.hasNextPage);
        setNovels(onlyTop ? before => before.concat(results) : results);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setNovels([]);
        setLoading(false);
        showToast(err.message);
      }
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

  const renderItem = (item: ALNovel) => (
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

  const listEmpty = useMemo(
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
            icon: RefreshIcon,
          },
        ]}
        theme={theme}
      />
    ),
    [error, searchAniList, theme],
  );

  return (
    <Screen
      topBar={
        <SearchbarV2
          theme={theme}
          placeholder="Search AniList"
          leftIcon={ArrowBackIcon}
          handleBackAction={() => navigation.goBack()}
          searchText={searchText}
          onChangeText={text => setSearchText(text)}
          onSubmitEditing={() => searchAniList(false, 1)}
          clearSearchbar={clearSearchbar}
          rightIcons={[
            {
              iconName: PublicIcon,
              onPress: () => WebBrowser.openBrowserAsync(anilistUrl),
            },
          ]}
        />
      }
      list={
        !loading && novels.length ? (
          <ComposeList
            contentPadding={{ bottom: 8, horizontal: 4 }}
            data={novels}
            keyExtractor={item => item.id + '_' + item.novelName}
            renderItem={renderItem}
            onEndReached={() => {
              if (hasNextPage && !searchText) {
                searchAniList(true, Math.ceil((limit + 50) / 50));
                setLimit(before => before + 50);
              }
            }}
            footer={!searchText ? <LoadingMoreIndicator theme={theme} /> : null}
          />
        ) : undefined
      }
    >
      {loading ? (
        <TrackerLoading theme={theme} />
      ) : novels.length ? null : (
        listEmpty
      )}
    </Screen>
  );
};

export default BrowseALScreen;
