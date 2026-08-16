import reverse from 'lodash-es/reverse';
import uniqBy from 'lodash-es/uniqBy';

import { getEnabledRepositoriesFromDb } from '@database/queries/RepositoryQueries';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { newer } from '@utils/compareVersion';
import NativeFile from '@modules/native-file';
import { showToast } from '@utils/showToast';
import { LEGACY_PLUGIN_STORAGE, PLUGIN_STORAGE } from '@utils/Storages';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';

import {
  store,
  Storage,
  LocalStorage,
  SessionStorage,
} from './helpers/storage';
import { NovelStatus, Plugin, PluginItem } from './types';
import { defaultCover } from './helpers/constants';
import { downloadFile, fetchApi, fetchProto, fetchText } from './helpers/fetch';
import { FilterTypes } from './types/filterTypes';
import { isUrlAbsolute } from './helpers/isAbsoluteUrl';

/**
 * The parsing and crypto libraries handed to plugins are some of the heaviest
 * modules in the bundle (cheerio alone pulls in parse5, css-select, domhandler
 * and domutils). This module is loaded during app initialisation, so importing
 * them statically evaluated all of them before the first frame even for users
 * with no plugins installed. Each entry is built on first use instead and
 * memoised, so a launch only pays for what the installed plugins ask for.
 */
const packageFactories: Record<string, () => any> = {
  'htmlparser2': () => ({ Parser: require('htmlparser2').Parser }),
  'cheerio': () => ({ load: require('cheerio').load }),
  'dayjs': () => require('dayjs').default ?? require('dayjs'),
  'urlencode': () => {
    const { encode, decode } = require('urlencode');
    return { encode, decode };
  },
  '@libs/novelStatus': () => ({ NovelStatus }),
  '@libs/fetch': () => ({ fetchApi, fetchText, fetchProto }),
  '@libs/isAbsoluteUrl': () => ({ isUrlAbsolute }),
  '@libs/filterInputs': () => ({ FilterTypes }),
  '@libs/defaultCover': () => ({ defaultCover }),
  '@libs/aes': () => ({ gcm: require('@noble/ciphers/aes.js').gcm }),
  '@libs/utils': () => {
    const { utf8ToBytes, bytesToUtf8 } = require('@noble/ciphers/utils.js');
    return { utf8ToBytes, bytesToUtf8 };
  },
};

const resolvedPackages: Record<string, any> = {};

const resolvePackage = (packageName: string) => {
  if (!(packageName in resolvedPackages)) {
    const factory = packageFactories[packageName];
    if (!factory) {
      return undefined;
    }
    resolvedPackages[packageName] = factory();
  }

  return resolvedPackages[packageName];
};

const initPlugin = (pluginId: string, rawCode: string) => {
  try {
    const _require = (packageName: string) => {
      if (packageName === '@libs/storage') {
        return {
          storage: new Storage(pluginId),
          localStorage: new LocalStorage(pluginId),
          sessionStorage: new SessionStorage(pluginId),
        };
      }
      return resolvePackage(packageName);
    };
    /* eslint no-new-func: "off", curly: "error" */
    const plugin: Plugin = Function(
      'require',
      'module',
      `const exports = module.exports = {};
      ${rawCode};
      return exports.default`,
    )(_require, {});

    if (!plugin.imageRequestInit) {
      plugin.imageRequestInit = {
        headers: { 'User-Agent': getUserAgent() },
      };
    } else {
      if (!plugin.imageRequestInit.headers) {
        plugin.imageRequestInit.headers = {};
      }

      const hasUserAgent = Object.keys(plugin.imageRequestInit.headers).some(
        header => header.toLowerCase() === 'user-agent',
      );

      if (!hasUserAgent) {
        plugin.imageRequestInit.headers['User-Agent'] = getUserAgent();
      }
    }

    return plugin;
  } catch {
    return undefined;
  }
};

const plugins: Record<string, Plugin | undefined> = {};
export const INSTALLED_PLUGINS_KEY = 'INSTALL_PLUGINS';
const PLUGIN_FILES = ['custom.js', 'custom.css', 'index.js'] as const;

// v2.1.0 stored plugin bundles in getExternalFilesDir(), which can be unavailable
// on some Android devices and leave installed plugin metadata without its bundle.
// Copy legacy bundles into reliable internal storage, retaining the originals so
// an interrupted migration can be retried safely on the next launch.
const migrateLegacyPluginFiles = async (pluginId: string) => {
  if (LEGACY_PLUGIN_STORAGE === PLUGIN_STORAGE) {
    return;
  }

  const legacyIndexPath = `${LEGACY_PLUGIN_STORAGE}/${pluginId}/index.js`;
  const pluginIndexPath = `${PLUGIN_STORAGE}/${pluginId}/index.js`;
  if (
    (await NativeFile.exists(pluginIndexPath)) ||
    !(await NativeFile.exists(legacyIndexPath))
  ) {
    return;
  }

  const pluginDir = `${PLUGIN_STORAGE}/${pluginId}`;
  await NativeFile.mkdir(pluginDir);
  for (const filename of PLUGIN_FILES) {
    const legacyPath = `${LEGACY_PLUGIN_STORAGE}/${pluginId}/${filename}`;
    if (await NativeFile.exists(legacyPath)) {
      const destinationPath = `${pluginDir}/${filename}`;
      await NativeFile.writeFile(
        destinationPath,
        await NativeFile.readFile(legacyPath),
      );
    }
  }
};

const installPlugin = async (
  _plugin: PluginItem,
): Promise<Plugin | undefined> => {
  const rawCode = await fetch(_plugin.url, {
    headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' },
  }).then(res => res.text());
  const plugin = initPlugin(_plugin.id, rawCode);
  if (!plugin) {
    return undefined;
  }
  let currentPlugin = plugins[plugin.id];
  if (!currentPlugin || newer(plugin.version, currentPlugin.version)) {
    // save plugin code;
    const pluginDir = `${PLUGIN_STORAGE}/${plugin.id}`;
    await NativeFile.mkdir(pluginDir);
    const pluginPath = pluginDir + '/index.js';
    const customJSPath = pluginDir + '/custom.js';
    const customCSSPath = pluginDir + '/custom.css';
    if (_plugin.customJS) {
      await downloadFile(_plugin.customJS, customJSPath);
    } else if (await NativeFile.exists(customJSPath)) {
      await NativeFile.unlink(customJSPath);
    }
    if (_plugin.customCSS) {
      await downloadFile(_plugin.customCSS, customCSSPath);
    } else if (await NativeFile.exists(customCSSPath)) {
      await NativeFile.unlink(customCSSPath);
    }
    await NativeFile.writeFile(pluginPath, rawCode);
    plugins[plugin.id] = plugin;
    currentPlugin = plugin;
  }
  return currentPlugin;
};

const uninstallPlugin = async (_plugin: PluginItem) => {
  plugins[_plugin.id] = undefined;
  store.getAllKeys().forEach(key => {
    if (key.startsWith(_plugin.id)) {
      store.remove(key);
    }
  });
  const pluginFilePath = `${PLUGIN_STORAGE}/${_plugin.id}/index.js`;
  if (await NativeFile.exists(pluginFilePath)) {
    await NativeFile.unlink(pluginFilePath);
  }
};

const updatePlugin = async (plugin: PluginItem) => {
  return installPlugin(plugin);
};

const fetchPlugins = async (): Promise<PluginItem[]> => {
  const allPlugins: PluginItem[] = [];
  const allRepositories = await getEnabledRepositoriesFromDb();

  const repoPluginsRes = await Promise.allSettled(
    allRepositories.map(({ url }) => fetch(url).then(res => res.json())),
  );

  repoPluginsRes.forEach(repoPlugins => {
    if (repoPlugins.status === 'fulfilled') {
      allPlugins.push(...repoPlugins.value);
    } else {
      showToast(repoPlugins.reason.toString());
    }
  });

  return uniqBy(reverse(allPlugins), 'id');
};

const getPlugin = (pluginId: string) => {
  if (pluginId === LOCAL_PLUGIN_ID) {
    return undefined;
  }

  return plugins[pluginId];
};

const loadPlugin = async (pluginId: string) => {
  if (pluginId === LOCAL_PLUGIN_ID) {
    return undefined;
  }
  if (plugins[pluginId]) {
    return plugins[pluginId];
  }

  const filePath = `${PLUGIN_STORAGE}/${pluginId}/index.js`;
  try {
    const code = await NativeFile.readFile(filePath);
    const plugin = initPlugin(pluginId, code);
    plugins[pluginId] = plugin;
    return plugin;
  } catch {
    return undefined;
  }
};

type InstalledPluginsInitialization = {
  /**
   * Resolves once the bundles that were missing from disk have been
   * re-downloaded. Startup does not have to wait for it.
   */
  repaired: Promise<void>;
};

const initializeInstalledPlugins =
  async (): Promise<InstalledPluginsInitialization> => {
    const installedPlugins =
      getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS_KEY) || [];

    const results = await Promise.allSettled(
      installedPlugins.map(async plugin => {
        try {
          await migrateLegacyPluginFiles(plugin.id);
        } catch {
          // A failed migration can still be recovered by re-downloading below.
        }

        return (await loadPlugin(plugin.id)) ? undefined : plugin;
      }),
    );

    const missingPlugins = results.flatMap(result =>
      result.status === 'fulfilled' && result.value ? [result.value] : [],
    );

    // Re-downloading a bundle needs the repository, and awaiting it here kept
    // the splash screen up for as long as the request took — until it timed
    // out when the device was offline. The plugin stays unusable until the
    // download lands either way, so the app is allowed to start meanwhile.
    const repaired = Promise.allSettled(
      missingPlugins.map(plugin => installPlugin(plugin)),
    ).then(() => undefined);

    return { repaired };
  };

const reloadInstalledPlugins = async (): Promise<string[]> => {
  const installedPlugins =
    getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS_KEY) || [];

  Object.keys(plugins).forEach(pluginId => {
    plugins[pluginId] = undefined;
  });

  const results = await Promise.all(
    installedPlugins.map(async plugin => ({
      plugin,
      source: await loadPlugin(plugin.id),
    })),
  );
  const restoredPlugins = results
    .filter(result => result.source)
    .map(result => result.plugin);

  setMMKVObject(INSTALLED_PLUGINS_KEY, restoredPlugins);

  return results
    .filter(result => !result.source)
    .map(result => result.plugin.id);
};

const LOCAL_PLUGIN_ID = 'local';

export {
  getPlugin,
  loadPlugin,
  initializeInstalledPlugins,
  reloadInstalledPlugins,
  installPlugin,
  uninstallPlugin,
  updatePlugin,
  fetchPlugins,
  LOCAL_PLUGIN_ID,
};
