import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useBackgroundTasks } from '@hooks/persisted/useBackgroundTasks';
import {
  isMigrationPersisted,
  type MigrationTarget,
} from '@services/migrate/verifyMigration';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';

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
  const [pendingMigration, setPendingMigration] = useState<MigrationTarget>();
  const [enqueuedTarget, setEnqueuedTarget] = useState<MigrationTarget>();
  const theme = useTheme();

  const isMounted = React.useRef(true);

  const [progress, setProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<SourceSearchResult[]>([]);

  const { library } = useLibraryNovels();

  const filteredInstalledPlugins = useFilteredInstalledPlugins();

  const pendingToNovelPath = pendingMigration?.toNovelPath;
  const pendingPluginId = pendingMigration?.pluginId;
  const isMigrationQueued = useBackgroundTasks(
    useCallback(
      tasks =>
        tasks.some(
          item =>
            item.task.name === 'MIGRATE_NOVEL' &&
            item.task.data.fromNovel.id === novel.id &&
            item.task.data.pluginId === pendingPluginId &&
            item.task.data.toNovelPath === pendingToNovelPath,
        ),
      [novel.id, pendingPluginId, pendingToNovelPath],
    ),
  );

  // Survives leaving and re-entering the screen, unlike the local pending state.
  const isSourceMigrating = useBackgroundTasks(
    useCallback(
      tasks =>
        tasks.some(
          item =>
            item.task.name === 'MIGRATE_NOVEL' &&
            item.task.data.fromNovel.id === novel.id,
        ),
      [novel.id],
    ),
  );

  const unsubscribeFocusRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => unsubscribeFocusRef.current?.(), []);

  const handleMigrationAborted = useCallback((target: MigrationTarget) => {
    // A late abort of an earlier migration must not touch a newer one.
    setPendingMigration(current => (current === target ? undefined : current));
  }, []);

  const handleMigrationBlocked = useCallback(() => {
    showToast(getString('browseScreen.migration.inProgress'));
  }, []);

  useEffect(() => {
    // Only a task confirmed as queued and since gone has finished. Before that
    // notification permission may still be requested, so only an already
    // persisted migration counts as finished.
    if (!pendingMigration || isMigrationQueued) {
      return;
    }
    if (
      enqueuedTarget !== pendingMigration &&
      !isMigrationPersisted(pendingMigration)
    ) {
      return;
    }

    // The task left the queue: close only if the migration really persisted.
    setEnqueuedTarget(undefined);
    setPendingMigration(undefined);
    if (isMigrationPersisted(pendingMigration)) {
      showToast(getString('browseScreen.migration.success'));
      // A novel previewed from the results may be on top: close this screen
      // once it is focused again instead of from underneath the preview.
      if (navigation.isFocused()) {
        navigation.pop(2);
      } else {
        unsubscribeFocusRef.current = navigation.addListener('focus', () => {
          unsubscribeFocusRef.current?.();
          unsubscribeFocusRef.current = undefined;
          navigation.pop(2);
        });
      }
    } else {
      showToast(getString('browseScreen.migration.failed'));
    }
  }, [enqueuedTarget, isMigrationQueued, navigation, pendingMigration]);

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
          isMigrating={pendingMigration !== undefined || isSourceMigrating}
          onMigrationQueued={setPendingMigration}
          onMigrationAborted={handleMigrationAborted}
          onMigrationEnqueued={setEnqueuedTarget}
          onMigrationBlocked={handleMigrationBlocked}
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
