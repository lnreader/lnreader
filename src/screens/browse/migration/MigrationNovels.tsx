import React, { useCallback, useEffect, useState } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { useFilteredInstalledPlugins, useTheme } from '@hooks/persisted';

import EmptyView from '@components/EmptyView';
import MigrationNovelList from './MigrationNovelList';

import { getPlugin } from '@plugins/pluginManager';
import { useLibraryNovels } from '@screens/library/hooks/useLibrary';
import {
  Appbar,
  AppText,
  ComposeList,
  ProgressIndicator,
  Screen,
  useScreenInsets,
} from '@components';
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
  const { bottom } = useScreenInsets();

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
        try {
          const source = getPlugin(item.id);
          if (!source) {
            throw new Error(`Unknown plugin: ${item.id}`);
          }
          const data = await source.searchNovels(novel.name, 1);
          setSearchResults(prevState =>
            prevState.map(pluginItem =>
              pluginItem.id === item.id
                ? { ...pluginItem, novels: data, loading: false }
                : { ...pluginItem },
            ),
          );
        } catch (e: any) {
          setSearchResults(prevState =>
            prevState.map(pluginItem =>
              pluginItem.id === item.id
                ? {
                    ...pluginItem,
                    loading: false,
                    error: e?.message,
                  }
                : pluginItem,
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
  const renderItem = (item: SourceSearchResult) => (
    <Column modifiers={[fillMaxWidth()]}>
      <Column modifiers={[padding(16, 16, 16, 8)]}>
        <AppText variant="bodyLarge">{item.name}</AppText>
        <AppText variant="bodySmall" color={theme.onSurfaceVariant}>
          {item.lang}
        </AppText>
      </Column>
      {item.error ? (
        <AppText
          variant="bodyMedium"
          color={theme.error}
          modifiers={[padding(16, 16, 16, 16)]}
        >
          {item.error}
        </AppText>
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
    </Column>
  );

  return (
    <Screen
      topBar={
        <Column modifiers={[fillMaxWidth()]}>
          <Appbar
            title={novel.name}
            handleGoBack={navigation.goBack}
            theme={theme}
          />
          {progress > 0 ? (
            <ProgressIndicator
              progress={Math.round(1000 * progress) / 1000}
              modifiers={[fillMaxWidth()]}
            />
          ) : null}
        </Column>
      }
      list={
        searchResults.length ? (
          <ComposeList
            contentPadding={{ bottom: bottom + 16 }}
            data={searchResults}
            keyExtractor={item => item.id}
            renderItem={renderItem}
          />
        ) : undefined
      }
    >
      {searchResults.length ? null : (
        <EmptyView
          icon="__φ(．．)"
          description={`Search a novel in your pinned plugins ${
            filteredInstalledPlugins.length === 0 ? '(No plugins pinned)' : ''
          }`}
        />
      )}
    </Screen>
  );
};

export default MigrationNovels;
