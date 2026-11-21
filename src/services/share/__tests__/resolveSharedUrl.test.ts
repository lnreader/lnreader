import type { PluginItem } from '@plugins/types';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { resolveNovelLink, resolveSharedUrl } from '../resolveSharedUrl';

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

const testSource = createPlugin(
  'test-source',
  'https://testsource.example.com/',
  'Test Source',
);
const plain = createPlugin('plain', 'https://example.com');
const royalRoad = createPlugin(
  'royalroad',
  'https://www.royalroad.com/',
  'Royal Road',
);
const subPath = createPlugin('sub-path', 'https://example.com/novels/');

const mockGetMMKVObject = getMMKVObject as jest.Mock;

beforeEach(() => {
  mockGetMMKVObject.mockReturnValue([testSource]);
});

describe('resolveSharedUrl', () => {
  it('opens the novel when one installed plugin site prefixes the URL', () => {
    expect(
      resolveSharedUrl(
        'https://testsource.example.com/fiction/21220/mother-of-learning',
      ),
    ).toEqual({
      kind: 'novel',
      pluginId: 'test-source',
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
        'https://testsource.example.com/fiction/21220/title?src=share#ch1',
      ),
    ).toEqual({
      kind: 'novel',
      pluginId: 'test-source',
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
      resolveSharedUrl('https://testsource.example.com/fiction/21220/x'),
    ).toEqual({
      kind: 'search',
      searchText: 'https://testsource.example.com/fiction/21220/x',
    });
  });
});

describe('resolveSharedUrl with a plugin site below the host root', () => {
  beforeEach(() => {
    mockGetMMKVObject.mockReturnValue([subPath]);
  });

  it('takes the path below the site path', () => {
    expect(resolveSharedUrl('https://example.com/novels/n/1/')).toEqual({
      kind: 'novel',
      pluginId: 'sub-path',
      path: 'n/1',
    });
  });

  it('does not match a sibling path that only starts with the site path', () => {
    expect(resolveSharedUrl('https://example.com/novelsx/n/1')).toEqual({
      kind: 'search',
      searchText: 'https://example.com/novelsx/n/1',
    });
  });
});

describe('resolveNovelLink', () => {
  beforeEach(() => {
    mockGetMMKVObject.mockReturnValue([royalRoad, testSource]);
  });

  it.each([
    'https://www.royalroad.com/fiction/21220/mother-of-learning',
    'https://www.royalroad.com/fiction/21220',
    'https://www.royalroad.com/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother',
    'https://www.royalroad.com/fiction/21220/chapter/301778',
    'https://www.royalroad.com/fiction/21220/mother-of-learning/reviews?page=2#review',
    'https://royalroad.com/fiction/21220/mother-of-learning?ref=note',
    'http://www.royalroad.com/fiction/21220/#reviews',
    'http://royalroad.com/fiction/21220',
  ])('resolves %s to the novel', href => {
    expect(resolveNovelLink(href)).toEqual({
      pluginId: 'royalroad',
      path: 'fiction/21220',
    });
  });

  it.each([
    'https://www.royalroad.com/',
    'https://www.royalroad.com/profile/12345',
    'https://www.royalroad.com/forums/thread/123',
    'https://www.royalroad.com/fictions/best-rated',
    'https://www.royalroad.com/fictions/search?title=hello',
    'https://www.royalroad.com/fiction/chapter/301778',
    'https://www.royalroad.com.evil.com/fiction/21220',
    'https://www.patreon.com/fiction/21220',
    'https://www.scribblehub.com/series/123/title',
    // A downloaded chapter has no web base URL, so its relative links do not
    // reach the app as Royal Road URLs.
    '/fiction/21220',
    'about:blank/fiction/21220',
    'royalroad.com/fiction/21220',
    'javascript:void(0)',
    'mailto:author@example.com',
    'not a url',
  ])('leaves %s to the WebView', href => {
    expect(resolveNovelLink(href)).toBeUndefined();
  });

  it('leaves links on a plugin site without a novel path rule to the WebView', () => {
    expect(
      resolveNovelLink('https://testsource.example.com/fiction/21220/x'),
    ).toBeUndefined();
  });

  it('does not resolve links when the plugin is not installed', () => {
    mockGetMMKVObject.mockReturnValue([testSource]);

    expect(
      resolveNovelLink('https://www.royalroad.com/fiction/21220'),
    ).toBeUndefined();
  });
});
