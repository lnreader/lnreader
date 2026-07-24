import { useCallback, useEffect, useMemo } from 'react';
import { getLocales } from 'expo-localization';
import { useMMKVObject } from 'react-native-mmkv';

import {
  fetchPlugins,
  installPlugin as installPluginSource,
  uninstallPlugin as uninstallPluginSource,
  updatePlugin as updatePluginSource,
  INSTALLED_PLUGINS_KEY,
} from '@plugins/pluginManager';
import { PluginItem } from '@plugins/types';
import { getString } from '@i18n/translations';
import { newer } from '@utils/compareVersion';
import { languagesMapping } from '@utils/constants/languages';
import { MMKVStorage, getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import {
  filterAvailablePlugins,
  filterInstalledPlugins,
  getLastUsedPluginId,
} from './pluginSelectors';

export const AVAILABLE_PLUGINS = 'AVAILABLE_PLUGINS';
export const INSTALLED_PLUGINS = INSTALLED_PLUGINS_KEY;
export const LANGUAGES_FILTER = 'LANGUAGES_FILTER';
export const LAST_USED_PLUGIN = 'LAST_USED_PLUGIN';
export const PINNED_PLUGINS = 'PINNED_PLUGINS';

const legacyFilteredPluginKeys = [
  'FILTERED_AVAILABLE_PLUGINS',
  'FILTERED_INSTALLED_PLUGINS',
];
const defaultLanguage =
  languagesMapping[getLocales()[0]?.languageCode ?? 'en'] ?? 'English';
const defaultLanguagesFilter = [defaultLanguage];
const emptyPluginList: PluginItem[] = [];
const emptyStringList: string[] = [];

const readPluginList = (key: string) =>
  getMMKVObject<PluginItem[]>(key) ?? emptyPluginList;

export const useInstalledPlugins = () => {
  const [installedPlugins = emptyPluginList] =
    useMMKVObject<PluginItem[]>(INSTALLED_PLUGINS);

  return installedPlugins;
};

export const useAvailablePlugins = () => {
  const [availablePlugins = emptyPluginList] =
    useMMKVObject<PluginItem[]>(AVAILABLE_PLUGINS);

  return availablePlugins;
};

export const useLanguagesFilter = () => {
  const [languagesFilter = defaultLanguagesFilter] =
    useMMKVObject<string[]>(LANGUAGES_FILTER);

  return languagesFilter;
};

export const usePinnedPlugins = () => {
  const [pinnedPlugins = emptyStringList] =
    useMMKVObject<string[]>(PINNED_PLUGINS);

  return pinnedPlugins;
};

export const useLastUsedPluginId = () => {
  const [storedLastUsedPlugin] = useMMKVObject<string | PluginItem>(
    LAST_USED_PLUGIN,
  );
  const lastUsedPluginId = getLastUsedPluginId(storedLastUsedPlugin);

  useEffect(() => {
    if (lastUsedPluginId && typeof storedLastUsedPlugin !== 'string') {
      setMMKVObject(LAST_USED_PLUGIN, lastUsedPluginId);
    }
  }, [lastUsedPluginId, storedLastUsedPlugin]);

  return lastUsedPluginId;
};

export const useFilteredInstalledPlugins = () => {
  const installedPlugins = useInstalledPlugins();
  const languagesFilter = useLanguagesFilter();

  return useMemo(
    () => filterInstalledPlugins(installedPlugins, languagesFilter),
    [installedPlugins, languagesFilter],
  );
};

export const useFilteredAvailablePlugins = () => {
  const availablePlugins = useAvailablePlugins();
  const installedPlugins = useInstalledPlugins();
  const languagesFilter = useLanguagesFilter();

  return useMemo(
    () =>
      filterAvailablePlugins(
        availablePlugins,
        installedPlugins,
        languagesFilter,
      ),
    [availablePlugins, installedPlugins, languagesFilter],
  );
};

export const usePluginActions = () => {
  const setLastUsedPluginId = useCallback((pluginId: string) => {
    setMMKVObject(LAST_USED_PLUGIN, pluginId);
  }, []);

  const refreshPlugins = useCallback(async () => {
    legacyFilteredPluginKeys.forEach(key => MMKVStorage.remove(key));

    const installedPlugins = readPluginList(INSTALLED_PLUGINS);
    const storedLastUsedPlugin = getMMKVObject<unknown>(LAST_USED_PLUGIN);
    const lastUsedPluginId = getLastUsedPluginId(storedLastUsedPlugin);
    if (lastUsedPluginId && typeof storedLastUsedPlugin !== 'string') {
      setMMKVObject(LAST_USED_PLUGIN, lastUsedPluginId);
    }
    const fetchedPlugins = await fetchPlugins();
    const fetchedPluginsById = new Map(
      fetchedPlugins.map(plugin => [plugin.id, plugin]),
    );

    let installedPluginsChanged = false;
    const updatedInstalledPlugins = installedPlugins.map(installedPlugin => {
      const fetchedPlugin = fetchedPluginsById.get(installedPlugin.id);

      if (
        !fetchedPlugin ||
        !newer(fetchedPlugin.version, installedPlugin.version)
      ) {
        return installedPlugin;
      }

      const updatedPlugin = {
        ...installedPlugin,
        hasUpdate: true,
        iconUrl: fetchedPlugin.iconUrl,
        url: fetchedPlugin.url,
      };
      installedPluginsChanged = true;

      return updatedPlugin;
    });

    if (installedPluginsChanged) {
      setMMKVObject(INSTALLED_PLUGINS, updatedInstalledPlugins);
    }
    setMMKVObject(AVAILABLE_PLUGINS, fetchedPlugins);
  }, []);

  const toggleLanguageFilter = useCallback((language: string) => {
    const languagesFilter =
      getMMKVObject<string[]>(LANGUAGES_FILTER) ?? defaultLanguagesFilter;
    const updatedFilter = languagesFilter.includes(language)
      ? languagesFilter.filter(item => item !== language)
      : [language, ...languagesFilter];

    setMMKVObject(LANGUAGES_FILTER, updatedFilter);
  }, []);

  const installPlugin = useCallback(async (plugin: PluginItem) => {
    const installedSource = await installPluginSource(plugin);

    if (!installedSource) {
      throw new Error(
        getString('browseScreen.installFailed', { name: plugin.name }),
      );
    }

    const installedPlugins = readPluginList(INSTALLED_PLUGINS);
    if (installedPlugins.some(item => item.id === plugin.id)) {
      return;
    }

    const installedPlugin: PluginItem = {
      ...plugin,
      version: installedSource.version,
      hasUpdate: false,
      hasSettings: !!installedSource.pluginSettings,
    };

    setMMKVObject(INSTALLED_PLUGINS, [...installedPlugins, installedPlugin]);
  }, []);

  const uninstallPlugin = useCallback(async (plugin: PluginItem) => {
    const uninstallPromise = uninstallPluginSource(plugin);
    const lastUsedPluginId = getLastUsedPluginId(
      getMMKVObject<unknown>(LAST_USED_PLUGIN),
    );
    const pinnedPlugins =
      getMMKVObject<string[]>(PINNED_PLUGINS) ?? emptyStringList;
    const installedPlugins = readPluginList(INSTALLED_PLUGINS);

    if (lastUsedPluginId === plugin.id) {
      MMKVStorage.remove(LAST_USED_PLUGIN);
    }
    if (pinnedPlugins.includes(plugin.id)) {
      setMMKVObject(
        PINNED_PLUGINS,
        pinnedPlugins.filter(id => id !== plugin.id),
      );
    }
    setMMKVObject(
      INSTALLED_PLUGINS,
      installedPlugins.filter(item => item.id !== plugin.id),
    );

    await uninstallPromise;
  }, []);

  const updatePlugin = useCallback(async (plugin: PluginItem) => {
    const updatedSource = await updatePluginSource(plugin);

    if (plugin.version === updatedSource?.version && !__DEV__) {
      throw new Error('No update found!');
    }
    if (!updatedSource) {
      throw new Error(getString('browseScreen.updateFailed'));
    }

    const installedPlugins = readPluginList(INSTALLED_PLUGINS);
    const updatedPlugin: PluginItem = {
      ...plugin,
      site: updatedSource.site,
      name: updatedSource.name,
      version: updatedSource.version,
      hasUpdate: false,
      hasSettings: !!updatedSource.pluginSettings,
    };

    setMMKVObject(
      INSTALLED_PLUGINS,
      installedPlugins.map(item =>
        item.id === plugin.id ? updatedPlugin : item,
      ),
    );

    return updatedSource.version;
  }, []);

  const togglePinPlugin = useCallback((pluginId: string) => {
    const pinnedPlugins =
      getMMKVObject<string[]>(PINNED_PLUGINS) ?? emptyStringList;
    const updatedPinnedPlugins = pinnedPlugins.includes(pluginId)
      ? pinnedPlugins.filter(id => id !== pluginId)
      : [...pinnedPlugins, pluginId];

    setMMKVObject(PINNED_PLUGINS, updatedPinnedPlugins);
  }, []);

  return useMemo(
    () => ({
      setLastUsedPluginId,
      refreshPlugins,
      toggleLanguageFilter,
      installPlugin,
      uninstallPlugin,
      updatePlugin,
      togglePinPlugin,
    }),
    [
      installPlugin,
      refreshPlugins,
      setLastUsedPluginId,
      toggleLanguageFilter,
      togglePinPlugin,
      uninstallPlugin,
      updatePlugin,
    ],
  );
};

export type PluginActions = ReturnType<typeof usePluginActions>;
