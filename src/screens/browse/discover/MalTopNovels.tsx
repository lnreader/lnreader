import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent } from 'react-native';

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
import { scrapeSearchResults, scrapeTopNovels } from './MyAnimeListScraper';
import DiscoverNovelCard from './DiscoverNovelCard';
import { useTheme } from '@hooks/persisted';
import MalLoading from '../loadingAnimation/MalLoading';
import { BrowseMalScreenProps } from '@navigators/types';
import ArrowBackIcon from '@expo/material-symbols/arrow_back.xml';

const BrowseMalScreen = ({ navigation }: BrowseMalScreenProps) => {
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [novels, setNovels] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(0);

  const [searchText, setSearchText] = useState('');

  const malUrl = 'https://myanimelist.net/topmanga.php?type=lightnovels';

  const getNovels = useCallback(
    async (lim?: number) => {
      try {
        const data = await scrapeTopNovels(lim ?? limit);
        setNovels(before => before.concat(data));
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setNovels([]);
        setLoading(false);
        showToast(err.message);
      }
    },
    [limit],
  );

  const clearSearchbar = () => {
    getNovels();
    setLoading(true);
    setSearchText('');
  };

  const getSearchResults = async () => {
    try {
      setLoading(true);
      const data = await scrapeSearchResults(searchText);

      setNovels(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setNovels([]);
      setLoading(false);
      showToast(err.message);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    getNovels();
  }, [getNovels]);

  const renderItem = (item: any) => (
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

  const isCloseToBottom = ({
    layoutMeasurement,
    contentOffset,
    contentSize,
  }: NativeScrollEvent) => {
    const paddingToBottom = 20;
    return (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom
    );
  };

  const loadingMore = useRef(false);

  const onScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: NativeScrollEvent }) => {
      if (!searchText && !loadingMore.current && isCloseToBottom(nativeEvent)) {
        loadingMore.current = true;

        setLimit(before => {
          const newLimit = before + 50;
          getNovels(newLimit).finally(() => {
            loadingMore.current = false;
          });
          return newLimit;
        });
      }
    },
    [searchText, getNovels],
  );

  const listEmpty = useMemo(
    () => (
      <ErrorView
        errorName={error || 'No results found'}
        actions={[
          {
            name: 'Retry',
            onPress: () => {
              getNovels();
              setLoading(true);
              setError('');
            },
            icon: RefreshIcon,
          },
        ]}
        theme={theme}
      />
    ),
    [error, theme, getNovels],
  );

  return (
    <Screen
      topBar={
        <SearchbarV2
          theme={theme}
          placeholder="Search MyAnimeList"
          leftIcon={ArrowBackIcon}
          handleBackAction={() => navigation.goBack()}
          searchText={searchText}
          onChangeText={text => setSearchText(text)}
          onSubmitEditing={getSearchResults}
          clearSearchbar={clearSearchbar}
          rightIcons={[
            {
              iconName: PublicIcon,
              onPress: () => WebBrowser.openBrowserAsync(malUrl),
            },
          ]}
        />
      }
      list={
        !loading && novels.length ? (
          <ComposeList
            contentPadding={{ bottom: 8, horizontal: 4 }}
            data={novels}
            keyExtractor={(item, index) => item.novelName + index}
            renderItem={renderItem}
            onScroll={onScroll}
            footer={!searchText ? <LoadingMoreIndicator theme={theme} /> : null}
          />
        ) : undefined
      }
    >
      {loading ? (
        <MalLoading theme={theme} />
      ) : novels.length ? null : (
        listEmpty
      )}
    </Screen>
  );
};

export default BrowseMalScreen;
