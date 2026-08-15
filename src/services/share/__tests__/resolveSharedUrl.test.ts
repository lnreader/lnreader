import type { PluginItem } from '@plugins/types';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { resolveSharedUrl } from '../resolveSharedUrl';

jest.mock('@plugins/pluginManager', () => ({
  INSTALLED_PLUGINS_KEY: 'INSTALL_PLUGINS',
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(),
  setMMKVObject: jest.fn(),
}));

const createPlugin = (id: string, site: string, name = id): PluginItem => ({
  id,
  name,
  site,
  lang: 'English',
  version: '1.0.0',
  url: `https://example.com/${id}.js`,
  iconUrl: `https://example.com/${id}.png`,
});

const royalroad = createPlugin(
  'royalroad',
  'https://www.royalroad.com/',
  'Royal Road',
);
const plain = createPlugin('plain', 'https://example.com');

const mockGetMMKVObject = getMMKVObject as jest.Mock;

beforeEach(() => {
  mockGetMMKVObject.mockReturnValue([royalroad]);
});

describe('resolveSharedUrl', () => {
  it('opens the novel when one installed plugin site prefixes the URL', () => {
    expect(
      resolveSharedUrl(
        'https://www.royalroad.com/fiction/21220/mother-of-learning',
      ),
    ).toEqual({
      kind: 'novel',
      pluginId: 'royalroad',
      path: 'fiction/21220/mother-of-learning',
    });
  });

  it('matches a site without a trailing slash and strips trailing slashes from the path', () => {
    mockGetMMKVObject.mockReturnValue([plain]);

    expect(resolveSharedUrl('https://example.com/novel/1/')).toEqual({
      kind: 'novel',
      pluginId: 'plain',
      path: 'novel/1',
    });
  });

  it('drops query and hash from the shared URL', () => {
    expect(
      resolveSharedUrl(
        'https://www.royalroad.com/fiction/21220/title?src=share#ch1',
      ),
    ).toEqual({
      kind: 'novel',
      pluginId: 'royalroad',
      path: 'fiction/21220/title',
    });
  });

  it('falls back to search when the URL is exactly a plugin site (no path)', () => {
    mockGetMMKVObject.mockReturnValue([plain]);

    expect(resolveSharedUrl('https://example.com')).toEqual({
      kind: 'search',
      searchText: 'https://example.com',
    });
  });

  it('falls back to search when no plugin site matches', () => {
    expect(resolveSharedUrl('https://www.someothersite.com/novel/1')).toEqual({
      kind: 'search',
      searchText: 'https://www.someothersite.com/novel/1',
    });
  });

  it('falls back to search when two plugins share the same site', () => {
    mockGetMMKVObject.mockReturnValue([plain, { ...plain, id: 'plain2' }]);

    expect(resolveSharedUrl('https://example.com/novel/1')).toEqual({
      kind: 'search',
      searchText: 'https://example.com/novel/1',
    });
  });

  it('does not match a site that is only a host prefix', () => {
    mockGetMMKVObject.mockReturnValue([plain]);

    expect(resolveSharedUrl('https://example.com.evil.com/x')).toEqual({
      kind: 'search',
      searchText: 'https://example.com.evil.com/x',
    });
  });

  it('ignores non-URL text', () => {
    expect(resolveSharedUrl('hello world')).toBeUndefined();
    expect(resolveSharedUrl('ftp://example.com/x')).toBeUndefined();
    expect(resolveSharedUrl('')).toBeUndefined();
  });

  it('trims surrounding whitespace from the shared text', () => {
    mockGetMMKVObject.mockReturnValue([plain]);

    expect(resolveSharedUrl('  https://example.com/novel/1  ')).toEqual({
      kind: 'novel',
      pluginId: 'plain',
      path: 'novel/1',
    });
  });

  it('falls back to search when no plugins are installed', () => {
    mockGetMMKVObject.mockReturnValue([]);

    expect(
      resolveSharedUrl('https://www.royalroad.com/fiction/21220/x'),
    ).toEqual({
      kind: 'search',
      searchText: 'https://www.royalroad.com/fiction/21220/x',
    });
  });
});
