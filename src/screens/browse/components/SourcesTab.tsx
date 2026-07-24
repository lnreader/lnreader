import { memo, useCallback, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  LegendList,
  LegendListRenderItemProps,
} from '@legendapp/list/react-native';

import { EmptyView, IconButtonV2 } from '@components';
import {
  useBrowseSettings,
  useFilteredInstalledPlugins,
  useLastUsedPluginId,
  usePinnedPlugins,
  usePluginActions,
} from '@hooks/persisted';
import { BrowseScreenProps } from '@navigators/types';
import { PluginItem } from '@plugins/types';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import { getLocaleLanguageName } from '@utils/constants/languages';

import DiscoverCard from '../discover/DiscoverCard';
import { buildSourceEntries, SourceEntry } from '../utils/buildBrowseEntries';

interface SourcesTabProps {
  navigation: BrowseScreenProps['navigation'];
  onOpenPlugins: () => void;
  searchText: string;
  theme: ThemeColors;
}

interface SourceRowProps {
  isPinned: boolean;
  onLatestPress: (plugin: PluginItem) => void;
  onPinPress: (plugin: PluginItem) => void;
  onPress: (plugin: PluginItem) => void;
  plugin: PluginItem;
  theme: ThemeColors;
}

const SourceRow = memo(
  ({
    isPinned,
    onLatestPress,
    onPinPress,
    onPress,
    plugin,
    theme,
  }: SourceRowProps) => (
    <View style={styles.sourceRow}>
      <Pressable
        accessibilityLabel={`${getString('browse')} ${plugin.name}`}
        accessibilityRole="button"
        style={styles.sourceRowAction}
        android_ripple={{ color: theme.rippleColor }}
        onPress={() => onPress(plugin)}
      />
      <View pointerEvents="none" style={styles.sourceMainContent}>
        <Image
          source={{ uri: plugin.iconUrl }}
          style={[styles.icon, { backgroundColor: theme.surfaceVariant }]}
        />
        <View style={styles.details}>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: theme.onSurface }]}
          >
            {plugin.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.description, { color: theme.onSurfaceVariant }]}
          >
            {getLocaleLanguageName(plugin.lang)}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel={`${getString('browseScreen.latest')} ${
          plugin.name
        }`}
        accessibilityRole="button"
        style={styles.latestButton}
        hitSlop={8}
        onPress={() => onLatestPress(plugin)}
      >
        <Text style={[styles.latestText, { color: theme.primary }]}>
          {getString('browseScreen.latest')}
        </Text>
      </Pressable>
      <IconButtonV2
        accessibilityLabel={
          isPinned
            ? getString('browseScreen.unpinSource', { name: plugin.name })
            : getString('browseScreen.pinSource', { name: plugin.name })
        }
        name={isPinned ? 'pin' : 'pin-outline'}
        color={isPinned ? theme.primary : theme.onSurfaceVariant}
        onPress={() => onPinPress(plugin)}
        theme={theme}
      />
    </View>
  ),
);

export const SourcesTab = memo(
  ({ navigation, onOpenPlugins, searchText, theme }: SourcesTabProps) => {
    const installedPlugins = useFilteredInstalledPlugins();
    const lastUsedPluginId = useLastUsedPluginId();
    const pinnedPlugins = usePinnedPlugins();
    const { setLastUsedPluginId, togglePinPlugin } = usePluginActions();
    const { showMyAnimeList, showAniList } = useBrowseSettings();

    const navigateToSource = useCallback(
      (plugin: PluginItem, showLatestNovels?: boolean) => {
        navigation.navigate('SourceScreen', {
          pluginId: plugin.id,
          pluginName: plugin.name,
          site: plugin.site,
          showLatestNovels,
        });
        setLastUsedPluginId(plugin.id);
      },
      [navigation, setLastUsedPluginId],
    );

    const openSource = useCallback(
      (plugin: PluginItem) => navigateToSource(plugin),
      [navigateToSource],
    );

    const openLatest = useCallback(
      (plugin: PluginItem) => navigateToSource(plugin, true),
      [navigateToSource],
    );

    const togglePin = useCallback(
      (plugin: PluginItem) => {
        togglePinPlugin(plugin.id);
      },
      [togglePinPlugin],
    );

    const entries = useMemo(() => {
      return buildSourceEntries({
        installedPlugins,
        lastUsedPluginId,
        pinnedPluginIds: pinnedPlugins,
        searchText,
        showAniList,
        showMyAnimeList,
      });
    }, [
      installedPlugins,
      lastUsedPluginId,
      pinnedPlugins,
      searchText,
      showAniList,
      showMyAnimeList,
    ]);

    const renderItem = useCallback(
      ({ item }: LegendListRenderItemProps<SourceEntry>) => {
        if (item.type === 'header') {
          return (
            <Text
              style={[styles.sectionHeader, { color: theme.onSurfaceVariant }]}
            >
              {item.title}
            </Text>
          );
        }

        if (item.type === 'discover') {
          const isAniList = item.tracker === 'AniList';
          return (
            <DiscoverCard
              theme={theme}
              icon={
                isAniList
                  ? require('../../../../assets/anilist.png')
                  : require('../../../../assets/mal.png')
              }
              trackerName={item.tracker}
              onPress={() =>
                navigation.navigate(isAniList ? 'BrowseAL' : 'BrowseMal')
              }
            />
          );
        }

        if (item.type === 'empty') {
          return (
            <View style={styles.inlineEmpty}>
              <EmptyView
                description={getString('browseScreen.noSources')}
                actions={[
                  {
                    iconName: 'puzzle-outline',
                    onPress: onOpenPlugins,
                    title: getString('browseScreen.plugins'),
                  },
                ]}
                theme={theme}
              />
            </View>
          );
        }

        return (
          <SourceRow
            plugin={item.plugin}
            isPinned={item.isPinned}
            onPress={openSource}
            onLatestPress={openLatest}
            onPinPress={togglePin}
            theme={theme}
          />
        );
      },
      [navigation, onOpenPlugins, openLatest, openSource, theme, togglePin],
    );

    return (
      <LegendList
        data={entries}
        estimatedItemSize={64}
        getItemType={item => item.type}
        keyExtractor={item => item.key}
        ListEmptyComponent={
          <EmptyView
            description={getString('browseScreen.noSearchResults')}
            theme={theme}
          />
        }
        contentContainerStyle={!entries.length ? styles.emptyList : undefined}
        recycleItems
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    );
  },
);

const styles = StyleSheet.create({
  description: {
    fontSize: 13,
    lineHeight: 20,
  },
  details: {
    flex: 1,
    marginStart: 16,
  },
  icon: {
    borderRadius: 4,
    height: 44,
    width: 44,
  },
  emptyList: {
    flexGrow: 1,
  },
  inlineEmpty: {
    height: 240,
  },
  latestButton: {
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  latestText: {
    fontSize: 14,
    fontWeight: '600',
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sourceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'relative',
  },
  sourceMainContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  sourceRowAction: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
