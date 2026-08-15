import type { PluginItem } from '@plugins/types';
import { newer } from '@utils/compareVersion';

export const getLastUsedPluginId = (storedValue: unknown) => {
  if (typeof storedValue === 'string') return storedValue;
  if (
    storedValue &&
    typeof storedValue === 'object' &&
    'id' in storedValue &&
    typeof storedValue.id === 'string'
  ) {
    return storedValue.id;
  }

  return undefined;
};

export const filterInstalledPlugins = (
  installedPlugins: readonly PluginItem[],
  languagesFilter: readonly string[],
) => {
  const enabledLanguages = new Set(languagesFilter);

  return installedPlugins.filter(plugin => enabledLanguages.has(plugin.lang));
};

export const filterAvailablePlugins = (
  availablePlugins: readonly PluginItem[],
  installedPlugins: readonly PluginItem[],
  languagesFilter: readonly string[],
) => {
  const enabledLanguages = new Set(languagesFilter);
  const installedPluginIds = new Set(installedPlugins.map(plugin => plugin.id));

  return availablePlugins
    .filter(
      plugin =>
        enabledLanguages.has(plugin.lang) && !installedPluginIds.has(plugin.id),
    )
    .sort((firstPlugin, secondPlugin) =>
      firstPlugin.name.localeCompare(secondPlugin.name),
    );
};

export const reconcileInstalledPluginUpdates = (
  installedPlugins: readonly PluginItem[],
  availablePlugins: readonly PluginItem[],
  clearUnavailableUpdates = false,
) => {
  const availablePluginsById = new Map(
    availablePlugins.map(plugin => [plugin.id, plugin]),
  );

  return installedPlugins.map(installedPlugin => {
    const availablePlugin = availablePluginsById.get(installedPlugin.id);

    if (
      !availablePlugin ||
      !newer(availablePlugin.version, installedPlugin.version)
    ) {
      return clearUnavailableUpdates && installedPlugin.hasUpdate
        ? { ...installedPlugin, hasUpdate: false }
        : installedPlugin;
    }

    return {
      ...installedPlugin,
      hasUpdate: true,
      iconUrl: availablePlugin.iconUrl,
      url: availablePlugin.url,
    };
  });
};
