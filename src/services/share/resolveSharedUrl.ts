import type { PluginItem } from '@plugins/types';
import { INSTALLED_PLUGINS_KEY } from '@plugins/pluginManager';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { getNovelByPathPrefix } from '@database/queries/NovelQueries';

export type NovelLink = { pluginId: string; path: string };

export type SharedUrlResult =
  | ({ kind: 'novel' } & NovelLink)
  | { kind: 'search'; searchText: string };

// A site serves one novel under several URLs (title slug, chapter pages). These
// rules reduce a site path to the path the plugin's browse/search results return;
// anything else on a site with a rule (profiles, forums) is not a novel.
const NOVEL_PATH_RULES: Record<string, (path: string) => string | undefined> = {
  royalroad: path => /^(fiction\/\d+)(?:\/|$)/.exec(path)?.[1],
};

// A novel saved from a shared URL keeps the long form, so reuse the stored
// record instead of creating a second one under the short path.
const toNovelLink = (pluginId: string, path: string): NovelLink => ({
  pluginId,
  path: getNovelByPathPrefix(path, pluginId)?.path ?? path,
});

const trimSlashes = (path: string) => path.replace(/^\/+|\/+$/g, '');
const stripWww = (host: string) => host.replace(/^www\./, '');

const parseWebUrl = (text: string): URL | undefined => {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url
      : undefined;
  } catch {
    return undefined;
  }
};

// Query/fragment are dropped so the path matches the paths the plugin's own
// search returns (no "?src=share" stuck to the novel path). Links in chapters
// often omit "www." or use another scheme than the plugin site.
const pathOnSite = (url: URL, site: string): string | undefined => {
  const siteUrl = parseWebUrl(site);
  if (!siteUrl || stripWww(siteUrl.host) !== stripWww(url.host)) {
    return undefined;
  }
  const sitePath = trimSlashes(siteUrl.pathname);
  const path = trimSlashes(url.pathname);
  if (!sitePath) {
    return path;
  }
  if (path === sitePath) {
    return '';
  }
  return path.startsWith(`${sitePath}/`)
    ? path.slice(sitePath.length + 1)
    : undefined;
};

// Accepts only a single match so the app never picks arbitrarily between
// plugins sharing a site; caller falls back to search otherwise.
const findPluginForUrl = (url: URL): NovelLink | undefined => {
  const installedPlugins =
    getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS_KEY) ?? [];
  const matches = installedPlugins.flatMap(plugin => {
    const path = pathOnSite(url, plugin.site);
    return path === undefined ? [] : [{ pluginId: plugin.id, path }];
  });
  return matches.length === 1 ? matches[0] : undefined;
};

/**
 * Resolves a link tapped inside a chapter to a novel of an installed plugin.
 * Only sites with a novel path rule qualify, so other same-site links (chapter
 * navigation, profiles) keep their normal behavior.
 */
export const resolveNovelLink = (href: string): NovelLink | undefined => {
  const url = parseWebUrl(href);
  const match = url ? findPluginForUrl(url) : undefined;
  if (!match) {
    return undefined;
  }
  const path = NOVEL_PATH_RULES[match.pluginId]?.(match.path);
  return path ? toNovelLink(match.pluginId, path) : undefined;
};

export const resolveSharedUrl = (text: string): SharedUrlResult | undefined => {
  const url = parseWebUrl(text);
  if (!url) {
    return undefined;
  }
  const searchText = text.trim();
  const match = findPluginForUrl(url);
  if (!match) {
    return { kind: 'search', searchText };
  }
  const rule = NOVEL_PATH_RULES[match.pluginId];
  if (!rule) {
    return match.path
      ? { kind: 'novel', ...match }
      : { kind: 'search', searchText };
  }
  const path = rule(match.path);
  return path
    ? { kind: 'novel', ...toNovelLink(match.pluginId, path) }
    : { kind: 'search', searchText };
};
