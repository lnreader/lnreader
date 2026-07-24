import { PluginItem } from '@plugins/types';
import { getString } from '@i18n/translations';
import { getLocaleLanguageName } from '@utils/constants/languages';

export type SourceEntry =
  | {
      key: string;
      title: string;
      type: 'header';
    }
  | {
      isPinned: boolean;
      key: string;
      plugin: PluginItem;
      type: 'source';
    }
  | {
      key: string;
      tracker: 'AniList' | 'MyAnimeList';
      type: 'discover';
    }
  | {
      key: 'no-sources';
      type: 'empty';
    };

interface BuildSourceEntriesOptions {
  installedPlugins: readonly PluginItem[];
  lastUsedPluginId?: string;
  pinnedPluginIds: readonly string[];
  searchText: string;
  showAniList: boolean;
  showMyAnimeList: boolean;
}

const matchesSearch = (plugin: PluginItem, normalizedSearch: string) =>
  plugin.name.toLocaleLowerCase().includes(normalizedSearch) ||
  plugin.id.toLocaleLowerCase().includes(normalizedSearch);

export const buildSourceEntries = ({
  installedPlugins,
  lastUsedPluginId,
  pinnedPluginIds,
  searchText,
  showAniList,
  showMyAnimeList,
}: BuildSourceEntriesOptions): SourceEntry[] => {
  const normalizedSearch = searchText.trim().toLocaleLowerCase();
  const sortedPlugins = [...installedPlugins].sort(
    (firstPlugin, secondPlugin) =>
      firstPlugin.lang.localeCompare(secondPlugin.lang) ||
      firstPlugin.name.localeCompare(secondPlugin.name),
  );
  const pinnedIds = new Set(pinnedPluginIds);

  if (normalizedSearch) {
    const searchResults = sortedPlugins.filter(plugin =>
      matchesSearch(plugin, normalizedSearch),
    );

    if (!searchResults.length) return [];

    return [
      {
        key: 'search-results-header',
        type: 'header',
        title: getString('browseScreen.searchResults'),
      },
      ...searchResults.map(
        plugin =>
          ({
            isPinned: pinnedIds.has(plugin.id),
            key: `search-${plugin.id}`,
            plugin,
            type: 'source',
          } as const),
      ),
    ];
  }

  const result: SourceEntry[] = [];
  const lastUsedPlugin = sortedPlugins.find(
    plugin => plugin.id === lastUsedPluginId,
  );
  const visibleLastUsedPluginId = lastUsedPlugin?.id;
  const pinned = sortedPlugins.filter(
    plugin => pinnedIds.has(plugin.id) && plugin.id !== visibleLastUsedPluginId,
  );
  const remaining = sortedPlugins.filter(
    plugin =>
      !pinnedIds.has(plugin.id) && plugin.id !== visibleLastUsedPluginId,
  );

  if (lastUsedPlugin) {
    result.push(
      {
        key: 'last-used-header',
        type: 'header',
        title: getString('browseScreen.lastUsed'),
      },
      {
        isPinned: pinnedIds.has(lastUsedPlugin.id),
        key: `last-used-${lastUsedPlugin.id}`,
        plugin: lastUsedPlugin,
        type: 'source',
      },
    );
  }

  if (pinned.length) {
    result.push({
      key: 'pinned-header',
      type: 'header',
      title: getString('browseScreen.pinnedPlugins'),
    });
    pinned.forEach(plugin =>
      result.push({
        isPinned: true,
        key: `pinned-${plugin.id}`,
        plugin,
        type: 'source',
      }),
    );
  }

  if (showAniList || showMyAnimeList) {
    result.push({
      key: 'discover-header',
      type: 'header',
      title: getString('browseScreen.discover'),
    });
    if (showAniList) {
      result.push({
        key: 'discover-anilist',
        tracker: 'AniList',
        type: 'discover',
      });
    }
    if (showMyAnimeList) {
      result.push({
        key: 'discover-mal',
        tracker: 'MyAnimeList',
        type: 'discover',
      });
    }
  }

  let previousLanguage: string | undefined;
  remaining.forEach(plugin => {
    if (plugin.lang !== previousLanguage) {
      result.push({
        key: `language-${plugin.lang}`,
        type: 'header',
        title: getLocaleLanguageName(plugin.lang),
      });
      previousLanguage = plugin.lang;
    }
    result.push({
      isPinned: false,
      key: `source-${plugin.id}`,
      plugin,
      type: 'source',
    });
  });

  if (!sortedPlugins.length) {
    result.push({ key: 'no-sources', type: 'empty' });
  }

  return result;
};

export type PluginStatus = 'available' | 'installed' | 'update';

export type PluginEntry =
  | {
      action?: 'updateAll';
      key: string;
      title: string;
      type: 'header';
    }
  | {
      key: string;
      plugin: PluginItem;
      status: PluginStatus;
      type: 'plugin';
    };

interface BuildPluginEntriesOptions {
  availablePlugins: readonly PluginItem[];
  installedPlugins: readonly PluginItem[];
  searchText: string;
}

export const buildPluginEntries = ({
  availablePlugins,
  installedPlugins,
  searchText,
}: BuildPluginEntriesOptions): PluginEntry[] => {
  const normalizedSearch = searchText.trim().toLocaleLowerCase();
  const installed = [...installedPlugins].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
  const available = [...availablePlugins].sort(
    (first, second) =>
      first.lang.localeCompare(second.lang) ||
      first.name.localeCompare(second.name),
  );

  if (normalizedSearch) {
    const installedMatches = installed.filter(plugin =>
      matchesSearch(plugin, normalizedSearch),
    );
    const availableMatches = available.filter(plugin =>
      matchesSearch(plugin, normalizedSearch),
    );

    if (!installedMatches.length && !availableMatches.length) return [];

    return [
      {
        key: 'plugin-search-header',
        title: getString('browseScreen.searchResults'),
        type: 'header',
      },
      ...installedMatches.map(
        plugin =>
          ({
            key: `installed-search-${plugin.id}`,
            plugin,
            status: plugin.hasUpdate ? 'update' : 'installed',
            type: 'plugin',
          } as const),
      ),
      ...availableMatches.map(
        plugin =>
          ({
            key: `available-search-${plugin.id}`,
            plugin,
            status: 'available',
            type: 'plugin',
          } as const),
      ),
    ];
  }

  const result: PluginEntry[] = [];
  const updates = installed.filter(plugin => plugin.hasUpdate);
  const installedWithoutUpdates = installed.filter(plugin => !plugin.hasUpdate);

  if (updates.length) {
    result.push({
      action: 'updateAll',
      key: 'updates-header',
      title: getString('browseScreen.updatesPending'),
      type: 'header',
    });
    updates.forEach(plugin =>
      result.push({
        key: `update-${plugin.id}`,
        plugin,
        status: 'update',
        type: 'plugin',
      }),
    );
  }

  if (installedWithoutUpdates.length) {
    result.push({
      key: 'installed-plugins-header',
      title: getString('browseScreen.installed'),
      type: 'header',
    });
    installedWithoutUpdates.forEach(plugin =>
      result.push({
        key: `installed-${plugin.id}`,
        plugin,
        status: 'installed',
        type: 'plugin',
      }),
    );
  }

  let previousLanguage: string | undefined;
  available.forEach(plugin => {
    if (plugin.lang !== previousLanguage) {
      result.push({
        key: `available-language-${plugin.lang}`,
        title: getLocaleLanguageName(plugin.lang),
        type: 'header',
      });
      previousLanguage = plugin.lang;
    }
    result.push({
      key: `available-${plugin.id}`,
      plugin,
      status: 'available',
      type: 'plugin',
    });
  });

  return result;
};
