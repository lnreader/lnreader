import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, FlatListProps } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { useFilteredInstalledPlugins, useTheme } from '@hooks/persisted';

import EmptyView from '@components/EmptyView';
import MigrationNovelList from './MigrationNovelList';

import { getPlugin } from '@plugins/pluginManager';
import { useLibraryNovels } from '@screens/library/hooks/useLibrary';
import { Appbar, SafeAreaView } from '@components';
import GlobalSearchSkeletonLoading from '../loadingAnimation/GlobalSearchSkeletonLoading';
import { MigrateNovelScreenProps } from '@navigators/types';
import { NovelItem } from '@plugins/types';

export interface SourceSearchResult {
  id: string;
  name: string;
  lang: string;
  loading: boolean;
  novels: NovelItem[];
  error?: any;
}

const MigrationNovels = ({ navigation, route }: MigrateNovelScreenProps) => {
  const { novel } = route.params;
  const theme = useTheme();

  const isMounted = React.useRef(true);

  const [progress, setProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<SourceSearchResult[]>([]);

  const { library } = useLibraryNovels();

  const filteredInstalledPlugins = useFilteredInstalledPlugins();

  const getSearchResults = useCallback(async () => {
    setSearchResults(
      filteredInstalledPlugins.map(item => ({
        id: item.id,
        name: item.name,
        lang: item.lang,
        loading: true,
        novels: [],
        error: null,
      })),
    );

    filteredInstalledPlugins.map(async item => {
      if (isMounted.current === true) {
        const source = getPlugin(item.id);
        if (!source) {
          setSearchResults(prevState =>
            prevState.map(pluginItem =>
              pluginItem.id === item.id
                ? {
                    ...pluginItem,
                    loading: false,
                    error: `Unknown plugin: ${item.id}`,
                  }
                : pluginItem,
            ),
          );
        } else {
          const data = await source.searchNovels(novel.name, 1);
          setSearchResults(prevState =>
            prevState.map(pluginItem =>
              pluginItem.id === item.id
                ? { ...pluginItem, novels: data, loading: false }
                : { ...pluginItem },
            ),
          );
        }
        setProgress(before => before + 1 / filteredInstalledPlugins.length);
      }
    });
  }, [filteredInstalledPlugins, novel.name]);

  useEffect(() => {
    getSearchResults();
  }, [getSearchResults]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const colorError = {
    color: theme.isDark ? '#F2B8B5' : '#B3261E',
  };

  const renderItem: FlatListProps<SourceSearchResult>['renderItem'] = ({
    item,
  }) => (
    <>
      <View style={styles.padding}>
        <Text style={{ color: theme.onSurface }}>{item.name}</Text>
        <Text style={[{ color: theme.onSurfaceVariant }, styles.fontSize]}>
          {item.lang}
        </Text>
      </View>
      {item.error ? (
        <Text style={[styles.error, colorError]}>{item.error}</Text>
      ) : item.loading ? (
        <GlobalSearchSkeletonLoading theme={theme} />
      ) : (
        <MigrationNovelList
          data={item}
          fromNovel={novel} // the novel will be migrated from
          theme={theme}
          library={library}
          navigation={navigation}
        />
      )}
    </>
  );

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={novel.name}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      {progress > 0 ? (
        <ProgressBar
          color={theme.primary}
          progress={Math.round(1000 * progress) / 1000}
        />
      ) : null}
      <FlatList
        contentContainerStyle={styles.flexGrow}
        data={searchResults}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        extraData={filteredInstalledPlugins}
        ListEmptyComponent={
          <EmptyView
            icon="__φ(．．)"
            description={`Search a novel in your pinned plugins ${
              filteredInstalledPlugins.length === 0 ? '(No plugins pinned)' : ''
            }`}
          />
        }
      />
    </SafeAreaView>
  );
};

export default MigrationNovels;

const styles = StyleSheet.create({
  error: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  flexGrow: { flexGrow: 1, padding: 4 },
  padding: { padding: 8, paddingVertical: 16 },
  fontSize: { fontSize: 12 },
});
