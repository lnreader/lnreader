import { renderHook } from '@testing-library/react-native';

import { fetchPlugins } from '@plugins/pluginManager';
import type { PluginItem } from '@plugins/types';
import { MMKVStorage, getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';

import {
  AVAILABLE_PLUGINS,
  FAILED_REPOSITORY_COUNT,
  INSTALLED_PLUGINS,
  usePluginActions,
} from '../usePlugins';

jest.mock('@plugins/pluginManager', () => ({
  fetchPlugins: jest.fn(),
  installPlugin: jest.fn(),
  uninstallPlugin: jest.fn(),
  updatePlugin: jest.fn(),
  INSTALLED_PLUGINS_KEY: 'INSTALLED_PLUGINS',
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: { remove: jest.fn(), set: jest.fn() },
  getMMKVObject: jest.fn(),
  setMMKVObject: jest.fn(),
}));

const createPlugin = (id: string, version = '1.0.0'): PluginItem => ({
  id,
  name: id,
  lang: 'English',
  site: `https://${id}.example.com`,
  version,
  url: `https://example.com/${id}.js`,
  iconUrl: `https://example.com/${id}.png`,
});

const stalePlugin = createPlugin('stale');
const onlinePlugin = createPlugin('online');
const installedWithUpdate = { ...stalePlugin, hasUpdate: true };

const mockStorage = (values: Record<string, unknown>) => {
  jest.mocked(getMMKVObject).mockImplementation(key => values[key]);
};

const refresh = async (clearUnavailableUpdates = false) => {
  const { result } = renderHook(() => usePluginActions());
  return result.current.refreshPlugins({ clearUnavailableUpdates });
};

describe('usePluginActions.refreshPlugins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage({
      [AVAILABLE_PLUGINS]: [stalePlugin, onlinePlugin],
      [INSTALLED_PLUGINS]: [installedWithUpdate],
    });
  });

  it('drops plugins that no enabled repository provides, even after a failure', async () => {
    jest.mocked(fetchPlugins).mockResolvedValue({
      plugins: [onlinePlugin],
      failedRepositories: ['https://offline.example.com/plugins.min.json'],
      complete: false,
    });

    await expect(refresh()).resolves.toEqual({ failedRepositoryCount: 1 });

    expect(setMMKVObject).toHaveBeenCalledWith(AVAILABLE_PLUGINS, [
      onlinePlugin,
    ]);
    expect(MMKVStorage.set).toHaveBeenCalledWith(FAILED_REPOSITORY_COUNT, 1);
  });

  it('clears updates from a disabled repository when failed repositories are cached', async () => {
    jest.mocked(fetchPlugins).mockResolvedValue({
      plugins: [onlinePlugin],
      failedRepositories: ['https://cached.example.com/plugins.min.json'],
      complete: true,
    });

    await refresh(true);

    expect(setMMKVObject).toHaveBeenCalledWith(INSTALLED_PLUGINS, [
      { ...installedWithUpdate, hasUpdate: false },
    ]);
  });

  it('keeps updates when an unreachable repository has no cached listing', async () => {
    jest.mocked(fetchPlugins).mockResolvedValue({
      plugins: [onlinePlugin],
      failedRepositories: ['https://offline.example.com/plugins.min.json'],
      complete: false,
    });

    await refresh(true);

    expect(setMMKVObject).not.toHaveBeenCalledWith(
      INSTALLED_PLUGINS,
      expect.anything(),
    );
  });
});
