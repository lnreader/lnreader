import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  FlatListProps,
} from 'react-native';

import * as WebBrowser from 'expo-web-browser';

import { ErrorView } from '@components/ErrorView/ErrorView';
import { SafeAreaView, SearchbarV2 } from '@components';

import { showToast } from '@utils/showToast';
import { scrapeSearchResults, scrapeTopNovels } from './MyAnimeListScraper';
import DiscoverNovelCard from './DiscoverNovelCard';
import { useTheme } from '@hooks/persisted';
import MalLoading from '../loadingAnimation/MalLoading';
import { BrowseMalScreenProps } from '@navigators/types';

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
      lim = lim ? lim : limit;
      try {
        const data = await scrapeTopNovels(lim);
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

  const renderItem: FlatListProps<any>['renderItem'] = ({ item }) => (
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

  const ListEmptyComponent = useCallback(
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
            icon: 'reload',
          },
        ]}
        theme={theme}
      />
    ),
    [error, theme, getNovels],
  );

  return (
    <SafeAreaView>
      <SearchbarV2
        theme={theme}
        placeholder="Search MyAnimeList"
        leftIcon="arrow-left"
        handleBackAction={() => navigation.goBack()}
        searchText={searchText}
        onChangeText={text => setSearchText(text)}
        onSubmitEditing={getSearchResults}
        clearSearchbar={clearSearchbar}
        rightIcons={[
          {
            iconName: 'earth',
            onPress: () => WebBrowser.openBrowserAsync(malUrl),
          },
        ]}
      />
      {loading ? (
        <MalLoading theme={theme} />
      ) : (
        <FlatList
          contentContainerStyle={styles.novelsContainer}
          data={novels}
          keyExtractor={(item, index) => item.novelName + index}
          renderItem={renderItem}
          ListEmptyComponent={ListEmptyComponent}
          onScroll={onScroll}
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

export default BrowseMalScreen;

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
