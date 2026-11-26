import { PluginItem } from '@plugins/types';

import { buildPluginEntries, buildSourceEntries } from '../buildBrowseEntries';

const plugin = (
  id: string,
  name: string,
  lang = 'English',
  hasUpdate = false,
): PluginItem => ({
  hasUpdate,
  iconUrl: `${id}.png`,
  id,
  lang,
  name,
  site: `https://${id}.example.com`,
  url: `https://example.com/${id}.js`,
  version: '1.0.0',
});

describe('buildSourceEntries', () => {
  const last = plugin('last', 'Last');
  const pinned = plugin('pinned', 'Pinned');
  const remaining = plugin('remaining', 'Remaining');

  it('orders discover, last used, pinned, then language groups without duplicates', () => {
    const entries = buildSourceEntries({
      installedPlugins: [remaining, pinned, last],
      lastUsedPluginId: last.id,
      pinnedPluginIds: [last.id, pinned.id],
      searchText: '',
      showAniList: true,
      showMyAnimeList: false,
    });

    expect(entries.map(entry => entry.key)).toEqual([
      'discover-header',
      'discover-anilist',
      'last-used-header',
      'last-used-last',
      'pinned-header',
      'pinned-pinned',
      'language-English',
      'source-remaining',
    ]);
    expect(
      entries
        .filter(entry => entry.type === 'source')
        .map(entry => entry.plugin.id),
    ).toEqual(['last', 'pinned', 'remaining']);
  });

  it('returns no entries when a search has no matches', () => {
    expect(
      buildSourceEntries({
        installedPlugins: [last],
        pinnedPluginIds: [],
        searchText: 'missing',
        showAniList: true,
        showMyAnimeList: true,
      }),
    ).toEqual([]);
  });

  it('adds an inline source empty state after discover content', () => {
    expect(
      buildSourceEntries({
        installedPlugins: [],
        pinnedPluginIds: [],
        searchText: '',
        showAniList: true,
        showMyAnimeList: false,
      }).map(entry => entry.key),
    ).toEqual(['discover-header', 'discover-anilist', 'no-sources']);
  });
});

describe('buildPluginEntries', () => {
  it('orders updates, installed plugins, then available language groups', () => {
    const entries = buildPluginEntries({
      availablePlugins: [plugin('available', 'Available')],
      installedPlugins: [
        plugin('installed', 'Installed'),
        plugin('update', 'Update', 'English', true),
      ],
      searchText: '',
    });

    expect(entries.map(entry => entry.key)).toEqual([
      'updates-header',
      'update-update',
      'installed-plugins-header',
      'installed-installed',
      'available-language-English',
      'available-available',
    ]);
  });

  it('sorts available plugins by language then name without mutating input', () => {
    const availablePlugins = [
      plugin('zulu', 'Zulu'),
      plugin('spanish', 'Alpha', 'Spanish'),
      plugin('bravo', 'Bravo'),
    ];

    const entries = buildPluginEntries({
      availablePlugins,
      installedPlugins: [],
      searchText: '',
    });

    expect(entries.map(entry => entry.key)).toEqual([
      'available-language-English',
      'available-bravo',
      'available-zulu',
      'available-language-Spanish',
      'available-spanish',
    ]);
    expect(availablePlugins.map(item => item.id)).toEqual([
      'zulu',
      'spanish',
      'bravo',
    ]);
  });

  it('returns no entries when a search has no matches', () => {
    expect(
      buildPluginEntries({
        availablePlugins: [plugin('available', 'Available')],
        installedPlugins: [],
        searchText: 'missing',
      }),
    ).toEqual([]);
  });
});
