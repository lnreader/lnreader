import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getEnabledRepositoriesFromDb } from '@database/queries/RepositoryQueries';

import { usePluginActions } from '../usePlugins';
import { usePluginIssues } from '../usePluginIssues';
import {
  pluginIssueIndexStore,
  type PluginIssueIndex,
} from '@plugins/issueIndex';
import type { PluginItem } from '@plugins/types';

jest.mock('@database/queries/RepositoryQueries', () => ({
  getEnabledRepositoriesFromDb: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

jest.mock('react-native-mmkv', () => ({
  useMMKVObject: jest.fn(),
}));

jest.mock('@plugins/pluginManager', () => ({
  fetchPlugins: jest.fn(),
  installPlugin: jest.fn(),
  uninstallPlugin: jest.fn(),
  updatePlugin: jest.fn(),
  INSTALLED_PLUGINS_KEY: 'INSTALLED_PLUGINS',
}));

jest.mock('@utils/mmkv/mmkv', () => {
  const storage = new Map<string, unknown>();
  return {
    __storage: storage,
    MMKVStorage: {
      remove: jest.fn((key: string) => storage.delete(key)),
    },
    getMMKVObject: jest.fn((key: string) => storage.get(key)),
    setMMKVObject: jest.fn((key: string, value: unknown) => {
      storage.set(key, value);
    }),
  };
});

jest.mock('@utils/fetch/fetch', () => ({
  fetchTimeout: jest.fn(),
}));

interface MMKVMock {
  __storage: Map<string, unknown>;
}

interface PluginManagerMock {
  fetchPlugins: jest.Mock;
}

interface FetchMock {
  fetchTimeout: jest.Mock;
}

const mockStorage = jest.requireMock<MMKVMock>('@utils/mmkv/mmkv').__storage;
const mockFetchPlugins = jest.requireMock<PluginManagerMock>(
  '@plugins/pluginManager',
).fetchPlugins;
const mockFetchTimeout =
  jest.requireMock<FetchMock>('@utils/fetch/fetch').fetchTimeout;
const mockGetEnabledRepositoriesFromDb = jest.mocked(
  getEnabledRepositoriesFromDb,
);

const installedPlugin: PluginItem = {
  id: 'galaxynovels',
  name: 'Galaxy Novels',
  site: 'https://galaxynovels.example.com',
  lang: 'English',
  version: '1.0.0',
  url: 'https://plugins.example.com/galaxynovels.js',
  iconUrl: 'https://plugins.example.com/galaxynovels.png',
};
const updatedPlugin: PluginItem = {
  ...installedPlugin,
  version: '2.0.0',
  url: 'https://updated.example.com/galaxynovels.js',
  iconUrl: 'https://updated.example.com/galaxynovels.png',
};
const reportFor = (
  issueNumber: number,
  owner = 'galaxy-team',
  name = 'novel-sources',
) => ({
  issueNumber,
  repository: { owner, name },
});
const issueIndexJsonFixture = {
  galaxynovels: [
    [6, 2133],
    [3, 2667],
  ],
  novelupdates: [[0, 729, 736]],
  emptyplugin: [],
};
const issueIndexFixture: PluginIssueIndex = {
  galaxynovels: [
    [6, reportFor(2133)],
    [3, reportFor(2667)],
  ],
  novelupdates: [[0, reportFor(729), reportFor(736)]],
  emptyplugin: [],
};
const defaultManifestUrl =
  'https://raw.githubusercontent.com/galaxy-team/novel-sources/plugins/v4/plugins.min.json';
const defaultIssueIndexUrl =
  'https://raw.githubusercontent.com/galaxy-team/novel-sources/issue-index/issue-index.min.json';

const jsonResponse = (body: unknown) => ({
  ok: true,
  json: jest.fn().mockResolvedValue(body),
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('plugin issue refresh integration', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockFetchPlugins.mockReset();
    mockFetchTimeout.mockReset();
    mockGetEnabledRepositoriesFromDb.mockReset();
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([
      { id: 1, url: defaultManifestUrl, enabled: true },
    ]);
    pluginIssueIndexStore.setState({
      index: undefined,
      isRefreshing: false,
      refreshFailed: false,
    });
  });

  it('persists manifest updates when configured issue refresh fails', async () => {
    mockStorage.set('INSTALLED_PLUGINS', [installedPlugin]);
    mockFetchPlugins.mockResolvedValue([updatedPlugin]);
    mockFetchTimeout.mockRejectedValue(new Error('issue index unavailable'));
    const { result } = renderHook(usePluginActions);

    await act(async () => {
      await result.current.refreshPlugins();
    });

    expect(mockStorage.get('AVAILABLE_PLUGINS')).toEqual([updatedPlugin]);
    expect(mockStorage.get('INSTALLED_PLUGINS')).toEqual([
      {
        ...installedPlugin,
        hasUpdate: true,
        url: updatedPlugin.url,
        iconUrl: updatedPlugin.iconUrl,
      },
    ]);
    expect(pluginIssueIndexStore.getState()).toEqual({
      index: undefined,
      isRefreshing: false,
      refreshFailed: true,
    });
    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      defaultIssueIndexUrl,
    ]);
  });

  it('persists manifests and publishes reports from a configured custom repository', async () => {
    mockStorage.set('INSTALLED_PLUGINS', [installedPlugin]);
    mockFetchPlugins.mockResolvedValue([updatedPlugin]);
    mockFetchTimeout.mockResolvedValue(jsonResponse(issueIndexJsonFixture));
    const { result: actions } = renderHook(usePluginActions);
    const { result: issues } = renderHook(() =>
      usePluginIssues('galaxynovels'),
    );

    await act(async () => {
      await actions.current.refreshPlugins();
    });

    expect(mockStorage.get('AVAILABLE_PLUGINS')).toEqual([updatedPlugin]);
    expect(pluginIssueIndexStore.getState()).toEqual({
      index: issueIndexFixture,
      isRefreshing: false,
      refreshFailed: false,
    });
    expect(issues.current.groups).toEqual(issueIndexFixture.galaxynovels);
    expect(mockStorage.get('PLUGIN_ISSUE_INDEX')).toEqual(issueIndexFixture);
    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      defaultIssueIndexUrl,
    ]);

    const updatedIssueIndexJson = {
      galaxynovels: [[2, 4242]],
    };
    const updatedIssueIndex: PluginIssueIndex = {
      galaxynovels: [[2, reportFor(4242, 'another-owner', 'another-source')]],
    };
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([
      {
        id: 1,
        url: 'https://raw.githubusercontent.com/another-owner/another-source/refs/heads/main/plugins.min.json',
        enabled: true,
      },
    ]);
    mockFetchTimeout.mockResolvedValue(jsonResponse(updatedIssueIndexJson));

    await act(async () => {
      await actions.current.refreshPlugins();
    });

    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      defaultIssueIndexUrl,
      'https://raw.githubusercontent.com/another-owner/another-source/issue-index/issue-index.min.json',
    ]);
    expect(pluginIssueIndexStore.getState().index).toEqual(updatedIssueIndex);
    expect(issues.current.groups).toEqual(updatedIssueIndex.galaxynovels);
    expect(mockStorage.get('PLUGIN_ISSUE_INDEX')).toEqual(updatedIssueIndex);
  });

  it('publishes issue reports even when manifest refresh rejects', async () => {
    mockFetchPlugins.mockRejectedValue(new Error('manifest unavailable'));
    mockFetchTimeout.mockResolvedValue(jsonResponse(issueIndexJsonFixture));
    const { result } = renderHook(usePluginActions);

    await act(async () => {
      await expect(result.current.refreshPlugins()).rejects.toThrow(
        'manifest unavailable',
      );
    });

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: issueIndexFixture,
      isRefreshing: false,
      refreshFailed: false,
    });
    expect(mockStorage.get('PLUGIN_ISSUE_INDEX')).toEqual(issueIndexFixture);
    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      defaultIssueIndexUrl,
    ]);
  });

  it('removes old report associations after a later successful empty refresh', async () => {
    mockFetchPlugins.mockResolvedValue([]);
    mockFetchTimeout
      .mockResolvedValueOnce(jsonResponse(issueIndexJsonFixture))
      .mockResolvedValueOnce(jsonResponse({}));
    const { result } = renderHook(usePluginActions);

    await act(async () => {
      await result.current.refreshPlugins();
    });
    expect(pluginIssueIndexStore.getState().index).toEqual(issueIndexFixture);

    await act(async () => {
      await result.current.refreshPlugins();
    });

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: {},
      isRefreshing: false,
      refreshFailed: false,
    });
    expect(mockStorage.get('PLUGIN_ISSUE_INDEX')).toEqual({});
    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      defaultIssueIndexUrl,
      defaultIssueIndexUrl,
    ]);
  });

  it('writes manifest results while waiting for the concurrent report request', async () => {
    mockFetchPlugins.mockResolvedValue([updatedPlugin]);
    const { promise: issueResponse, resolve: resolveIssueResponse } =
      createDeferred<unknown>();
    mockFetchTimeout.mockReturnValue(issueResponse);
    const { result } = renderHook(usePluginActions);
    let refreshFinished = false;

    const refresh = result.current.refreshPlugins().then(() => {
      refreshFinished = true;
    });

    await waitFor(() => {
      expect(mockStorage.get('AVAILABLE_PLUGINS')).toEqual([updatedPlugin]);
    });
    expect(refreshFinished).toBe(false);
    expect(pluginIssueIndexStore.getState().isRefreshing).toBe(true);

    resolveIssueResponse(jsonResponse(issueIndexJsonFixture));
    await act(async () => {
      await refresh;
    });

    expect(refreshFinished).toBe(true);
    expect(pluginIssueIndexStore.getState().index).toEqual(issueIndexFixture);
  });
});
