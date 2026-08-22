import type { PluginItem } from '@plugins/types';
import { INSTALLED_PLUGINS_KEY } from '@plugins/pluginManager';
import { getMMKVObject } from '@utils/mmkv/mmkv';

export type SharedUrlResult =
  | { kind: 'novel'; pluginId: string; path: string }
  | { kind: 'search'; searchText: string };

const normalizeTrailingSlash = (url: string) => url.replace(/\/+$/, '');

const normalizeSharedText = (text: string): string | undefined => {
  try {
    const url = new URL(text.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    // Query/fragment are dropped so the extracted path matches the paths the
    // plugin's own search returns (no "?src=share" stuck to the novel path).
    return url.origin + url.pathname;
  } catch {
    return undefined;
  }
};

// Accepts only a single match so the app never picks arbitrarily between
// plugins sharing a site; caller falls back to search otherwise.
const findPluginForUrl = (
  url: string,
  plugins: PluginItem[],
): PluginItem | undefined => {
  const normalizedUrl = normalizeTrailingSlash(url);
  const matches = plugins.filter(plugin => {
    const site = normalizeTrailingSlash(plugin.site);
    if (!normalizedUrl.startsWith(site)) {
      return false;
    }
    // '/' boundary guards against site "example.com" matching
    // "example.com.evil.com/…".
    return normalizedUrl.slice(site.length).startsWith('/');
  });
  return matches.length === 1 ? matches[0] : undefined;
};

export const resolveSharedUrl = (text: string): SharedUrlResult | undefined => {
  const url = normalizeSharedText(text);
  if (!url) {
    return undefined;
  }
  const searchText = text.trim();
  const installedPlugins =
    getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS_KEY) ?? [];
  const plugin = findPluginForUrl(url, installedPlugins);
  if (!plugin) {
    return { kind: 'search', searchText };
  }
  // parseNovel takes a path relative to the plugin site (plugins do
  // fetchApi(this.site + novelPath)); strip site prefix + slashes.
  const path = url
    .slice(normalizeTrailingSlash(plugin.site).length)
    .replace(/^\/+|\/+$/g, '');
  if (!path) {
    return { kind: 'search', searchText };
  }
  return { kind: 'novel', pluginId: plugin.id, path };
};
