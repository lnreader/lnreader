import NativeFile from '@modules/native-file';
import { getEnabledRepositoriesFromDb } from '@database/queries/RepositoryQueries';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import {
  fetchPlugins,
  getPlugin,
  initializeInstalledPlugins,
  installPlugin,
  INSTALLED_PLUGINS_KEY,
  reloadInstalledPlugins,
} from '../pluginManager';
import type { PluginItem } from '../types';

jest.mock('@database/queries/RepositoryQueries', () => ({
  getEnabledRepositoriesFromDb: jest.fn().mockResolvedValue([]),
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

const pluginCode = (id: string) => `exports.default = {
  id: '${id}',
  name: '${id}',
  version: '1.0.0',
  site: 'https://example.com'
};`;

describe('fetchPlugins', () => {
  it('fetches only the repositories selected by the enabled-repository query', async () => {
    const repositoryUrl = 'https://example.com/plugins.min.json';
    const plugin = {
      id: 'available',
      name: 'Available plugin',
    } as PluginItem;
    jest
      .mocked(getEnabledRepositoriesFromDb)
      .mockResolvedValueOnce([{ id: 1, url: repositoryUrl, enabled: true }]);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => [plugin],
    } as Response);

    await expect(fetchPlugins()).resolves.toEqual([plugin]);

    expect(getEnabledRepositoriesFromDb).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(repositoryUrl);
    fetchSpy.mockRestore();
  });

  it('drops listings whose id would escape the plugin directory', async () => {
    const plugin = { id: 'available', name: 'Available plugin' } as PluginItem;
    jest
      .mocked(getEnabledRepositoriesFromDb)
      .mockResolvedValueOnce([
        { id: 1, url: 'https://example.com/plugins.min.json', enabled: true },
      ]);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => [
        plugin,
        { id: '../../../escaped', name: 'Traversal' },
        { id: '..', name: 'Dot dot' },
        { id: 'back\\slash', name: 'Backslash' },
        { id: '', name: 'Empty' },
      ],
    } as Response);

    await expect(fetchPlugins()).resolves.toEqual([plugin]);

    fetchSpy.mockRestore();
  });
});

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

describe('initializeInstalledPlugins', () => {
  it('migrates a legacy bundle into internal storage before loading it', async () => {
    const plugin = {
      id: 'legacy',
      name: 'Legacy plugin',
      url: 'https://example.com/legacy.js',
    } as PluginItem;
    jest.mocked(getMMKVObject).mockReturnValueOnce([plugin]);
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(
        async path => path === '/mock/external/Plugins/legacy/index.js',
      );
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/legacy/index.js')) {
        return pluginCode('legacy');
      }
      throw new Error('Missing plugin bundle');
    });
    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy.mockClear();

    await initializeInstalledPlugins();

    expect(NativeFile.mkdir).toHaveBeenCalledWith(
      '/mock/documents/Plugins/legacy',
    );
    expect(NativeFile.writeFile).toHaveBeenCalledWith(
      '/mock/documents/Plugins/legacy/index.js',
      pluginCode('legacy'),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getPlugin('legacy')).toMatchObject({ id: 'legacy' });
  });

  it('downloads a replacement when the installed bundle is missing', async () => {
    const plugin = {
      id: 'missing',
      name: 'Missing plugin',
      url: 'https://example.com/missing.js',
    } as PluginItem;
    jest.mocked(getMMKVObject).mockReturnValueOnce([plugin]);
    jest.mocked(NativeFile.exists).mockResolvedValue(false);
    jest
      .mocked(NativeFile.readFile)
      .mockRejectedValue(new Error('Missing plugin bundle'));
    jest.spyOn(global, 'fetch').mockResolvedValue({
      text: async () => pluginCode('missing'),
    } as Response);

    await initializeInstalledPlugins();

    expect(NativeFile.writeFile).toHaveBeenCalledWith(
      '/mock/documents/Plugins/missing/index.js',
      pluginCode('missing'),
    );
    expect(getPlugin('missing')).toMatchObject({ id: 'missing' });
  });
});

describe('installPlugin', () => {
  it('does not register a plugin when its bundle cannot be persisted', async () => {
    const plugin = {
      id: 'write-failure',
      name: 'Write failure',
      url: 'https://example.com/write-failure.js',
    } as PluginItem;
    jest.spyOn(global, 'fetch').mockResolvedValue({
      text: async () => pluginCode('write-failure'),
    } as Response);
    jest
      .mocked(NativeFile.mkdir)
      .mockRejectedValueOnce(new Error('Directory could not be created'));

    await expect(installPlugin(plugin)).rejects.toThrow(
      'Directory could not be created',
    );
    expect(getPlugin('write-failure')).toBeUndefined();
  });

  it('writes nothing when the listed id would escape the plugin directory', async () => {
    const plugin = {
      id: '../../../../escaped',
      name: 'Traversal',
      url: 'https://example.com/traversal.js',
    } as PluginItem;
    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy.mockClear();
    jest.mocked(NativeFile.mkdir).mockClear();
    jest.mocked(NativeFile.writeFile).mockClear();

    await expect(installPlugin(plugin)).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(NativeFile.mkdir).not.toHaveBeenCalled();
    expect(NativeFile.writeFile).not.toHaveBeenCalled();
  });

  // the listing and the bundle carry separate ids, and the directory is built from the bundle's
  it('writes nothing when the bundle reports an escaping id', async () => {
    const plugin = {
      id: 'honest',
      name: 'Honest listing',
      url: 'https://example.com/honest.js',
    } as PluginItem;
    jest.spyOn(global, 'fetch').mockResolvedValue({
      text: async () => pluginCode('../../../../escaped'),
    } as Response);
    jest.mocked(NativeFile.mkdir).mockClear();
    jest.mocked(NativeFile.writeFile).mockClear();

    await expect(installPlugin(plugin)).resolves.toBeUndefined();

    expect(NativeFile.mkdir).not.toHaveBeenCalled();
    expect(NativeFile.writeFile).not.toHaveBeenCalled();
    expect(getPlugin('honest')).toBeUndefined();
  });
});
