import { getLocales } from 'expo-localization';
import { languagesMapping } from '@utils/constants/languages';
import { orderBy } from 'lodash-es';
import { useMMKVObject } from 'react-native-mmkv';
import { PluginItem } from '@plugins/types';
import {
  fetchPlugins,
  installPlugin as _install,
  uninstallPlugin as _uninstall,
  updatePlugin as _update,
  INSTALLED_PLUGINS_KEY,
} from '@plugins/pluginManager';
import { newer } from '@utils/compareVersion';
import { MMKVStorage, getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { useCallback } from 'react';
import { getString } from '@strings/translations';

export const AVAILABLE_PLUGINS = 'AVAILABLE_PLUGINS';
export const INSTALLED_PLUGINS = INSTALLED_PLUGINS_KEY;
export const LANGUAGES_FILTER = 'LANGUAGES_FILTER';
export const LAST_USED_PLUGIN = 'LAST_USED_PLUGIN';
export const PINNED_PLUGINS = 'PINNED_PLUGINS';
export const FILTERED_AVAILABLE_PLUGINS = 'FILTERED_AVAILABLE_PLUGINS';
export const FILTERED_INSTALLED_PLUGINS = 'FILTERED_INSTALLED_PLUGINS';

export default function usePlugins() {
  const defaultLang =
    languagesMapping[getLocales()[0]?.languageCode ?? 'en'] ?? 'English';

  const [lastUsedPlugin, setLastUsedPlugin] =
    useMMKVObject<PluginItem>(LAST_USED_PLUGIN);
  const [pinnedPlugins = [], setPinnedPlugins] =
    useMMKVObject<string[]>(PINNED_PLUGINS);
  const [languagesFilter = [defaultLang], setLanguagesFilter] =
    useMMKVObject<string[]>(LANGUAGES_FILTER);
  const [filteredAvailablePlugins = [], setFilteredAvailablePlugins] =
    useMMKVObject<PluginItem[]>(FILTERED_AVAILABLE_PLUGINS);
  const [filteredInstalledPlugins = [], setFilteredInstalledPlugins] =
    useMMKVObject<PluginItem[]>(FILTERED_INSTALLED_PLUGINS);
  /**
   * @param filter
   * We cant use the languagesFilter directly because it is updated only after component's lifecycle end.
   * And toggleLanguagFilter triggers filterPlugins before lifecycle end.
   */
  const filterPlugins = useCallback(
    (filter: string[]) => {
      const installedPlugins =
        getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
      const availablePlugins =
        getMMKVObject<PluginItem[]>(AVAILABLE_PLUGINS) || [];
      setFilteredInstalledPlugins(
        installedPlugins.filter(plg => filter.includes(plg.lang)),
      );
      setFilteredAvailablePlugins(
        orderBy(
          availablePlugins
            .filter(
              avalilablePlugin =>
                !installedPlugins.some(
                  installedPlugin => installedPlugin.id === avalilablePlugin.id,
                ),
            )
            .filter(plg => filter.includes(plg.lang)),
          'name',
        ),
      );
    },
    [setFilteredAvailablePlugins, setFilteredInstalledPlugins],
  );

  const refreshPlugins = useCallback(() => {
    const installedPlugins =
      getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
    return fetchPlugins().then(fetchedPlugins => {
      fetchedPlugins.filter(plg => {
        const finded = installedPlugins.find(v => v.id === plg.id);
        if (finded) {
          if (newer(plg.version, finded.version)) {
            finded.hasUpdate = true;
            finded.iconUrl = plg.iconUrl;
            finded.url = plg.url;
            if (finded.id === lastUsedPlugin?.id) {
              setLastUsedPlugin(finded);
            }
          }
          return false;
        }
        return true;
      });
      setMMKVObject(INSTALLED_PLUGINS, installedPlugins);
      setMMKVObject(AVAILABLE_PLUGINS, fetchedPlugins);
      filterPlugins(languagesFilter);
    });
  }, [filterPlugins, languagesFilter, lastUsedPlugin?.id, setLastUsedPlugin]);

  const toggleLanguageFilter = (lang: string) => {
    const newFilter = languagesFilter.includes(lang)
      ? languagesFilter.filter(l => l !== lang)
      : [lang, ...languagesFilter];
    setLanguagesFilter(newFilter);
    filterPlugins(newFilter);
  };

  /**
   * Variable scope naming
   * plugin: parameter
   * _plg: value returned by pluginManager functions
   * plg: parameter in JS class method callback (.map, .reducer, ...)
   */

  const installPlugin = (plugin: PluginItem) => {
    return _install(plugin).then(_plg => {
      if (_plg) {
        const installedPlugins =
          getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
        const actualPlugin: PluginItem = {
          ...plugin,
          version: _plg.version,
          hasSettings: !!_plg.pluginSettings,
        };
        // safe
        if (!installedPlugins.some(plg => plg.id === plugin.id)) {
          setMMKVObject(INSTALLED_PLUGINS, [...installedPlugins, actualPlugin]);
        }
        filterPlugins(languagesFilter);
      } else {
        throw new Error(
          getString('browseScreen.installFailed', { name: plugin.name }),
        );
      }
    });
  };

  const uninstallPlugin = (plugin: PluginItem) => {
    if (lastUsedPlugin?.id === plugin.id) {
      MMKVStorage.remove(LAST_USED_PLUGIN);
    }
    if (pinnedPlugins.includes(plugin.id)) {
      setPinnedPlugins(pinnedPlugins.filter(id => id !== plugin.id));
    }
    const installedPlugins =
      getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
    setMMKVObject(
      INSTALLED_PLUGINS,
      installedPlugins.filter(plg => plg.id !== plugin.id),
    );
    filterPlugins(languagesFilter);
    return _uninstall(plugin).then(() => {});
  };

  const updatePlugin = (plugin: PluginItem) => {
    return _update(plugin).then(_plg => {
      if (plugin.version === _plg?.version && !__DEV__) {
        throw new Error('No update found!');
      }
      if (_plg) {
        const installedPlugins =
          getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
        setMMKVObject<PluginItem[]>(
          INSTALLED_PLUGINS,
          installedPlugins.map(plg => {
            if (plugin.id !== plg.id) {
              return plg;
            }
            const newPlugin: PluginItem = {
              ...plugin,
              site: _plg.site,
              name: _plg.name,
              version: _plg.version,
              hasUpdate: false,
              hasSettings: !!_plg.pluginSettings,
            };
            if (newPlugin.id === lastUsedPlugin?.id) {
              setLastUsedPlugin(newPlugin);
            }
            return newPlugin;
          }),
        );
        filterPlugins(languagesFilter);
        return _plg.version;
      } else {
        throw Error(getString('browseScreen.updateFailed'));
      }
    });
  };

  const togglePinPlugin = useCallback(
    (pluginId: string) => {
      if (pinnedPlugins.includes(pluginId)) {
        setPinnedPlugins(pinnedPlugins.filter(id => id !== pluginId));
      } else {
        setPinnedPlugins([...pinnedPlugins, pluginId]);
      }
    },
    [pinnedPlugins, setPinnedPlugins],
  );

  const isPinned = useCallback(
    (pluginId: string) => pinnedPlugins.includes(pluginId),
    [pinnedPlugins],
  );

  return {
    filteredAvailablePlugins,
    filteredInstalledPlugins,
    lastUsedPlugin,
    pinnedPlugins,
    languagesFilter,
    setLastUsedPlugin,
    refreshPlugins,
    toggleLanguageFilter,
    installPlugin,
    uninstallPlugin,
    updatePlugin,
    togglePinPlugin,
    isPinned,
  };
}
