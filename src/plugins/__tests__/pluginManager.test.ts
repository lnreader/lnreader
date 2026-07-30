import NativeFile from '@modules/native-file';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import {
  getPlugin,
  INSTALLED_PLUGINS_KEY,
  reloadInstalledPlugins,
} from '../pluginManager';
import type { PluginItem } from '../types';

jest.mock('@database/queries/RepositoryQueries', () => ({
  getRepositoriesFromDb: jest.fn().mockResolvedValue([]),
}));

jest.mock('@noble/ciphers/aes.js', () => ({
  gcm: jest.fn(),
}));

jest.mock('@noble/ciphers/utils.js', () => ({
  bytesToUtf8: jest.fn(),
  utf8ToBytes: jest.fn(),
}));

jest.mock('cheerio', () => ({
  load: jest.fn(),
}));

jest.mock('htmlparser2', () => ({
  Parser: jest.fn(),
}));

jest.mock('@hooks/persisted/useUserAgent', () => ({
  getUserAgent: () => 'LNReader test',
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(),
  setMMKVObject: jest.fn(),
}));

const restoredPlugins = [
  { id: 'restored', name: 'Restored plugin' },
  { id: 'invalid', name: 'Invalid plugin' },
] as PluginItem[];

describe('reloadInstalledPlugins', () => {
  it('loads restored bundles and removes registry entries that cannot load', async () => {
    jest.mocked(getMMKVObject).mockReturnValueOnce(restoredPlugins);
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/restored/index.js')) {
        return `exports.default = {
          id: 'restored',
          name: 'Restored plugin',
          version: '1.0.0',
          site: 'https://example.com'
        };`;
      }
      throw new Error('Missing plugin bundle');
    });

    await expect(reloadInstalledPlugins()).resolves.toEqual(['invalid']);

    expect(getPlugin('restored')).toMatchObject({
      id: 'restored',
      version: '1.0.0',
    });
    expect(getPlugin('invalid')).toBeUndefined();
    expect(setMMKVObject).toHaveBeenCalledWith(INSTALLED_PLUGINS_KEY, [
      restoredPlugins[0],
    ]);
  });
});
