import type { PluginIssueIndex } from '../issueIndex';

const PLUGIN_ISSUE_INDEX = 'PLUGIN_ISSUE_INDEX';
const reportFor = (
  issueNumber: number,
  owner = 'example',
  name = 'source-a',
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
  'https://raw.githubusercontent.com/example/source-a/plugins/v4/plugins.min.json';
const defaultIssueIndexUrl =
  'https://raw.githubusercontent.com/example/source-a/issue-index/issue-index.min.json';
const PLUGIN_INDEX_HEADERS = {
  headers: { pragma: 'no-cache', 'cache-control': 'no-cache' },
};

const mockStorage = new Map<string, string>();
const mockGetMMKVObject = jest.fn();
const mockSetMMKVObject = jest.fn();
const mockFetchTimeout = jest.fn();
const mockGetEnabledRepositoriesFromDb = jest.fn();

jest.mock('@database/queries/RepositoryQueries', () => ({
  getEnabledRepositoriesFromDb: (...args: unknown[]) =>
    mockGetEnabledRepositoriesFromDb(...args),
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: (...args: [string]) => mockGetMMKVObject(...args),
  setMMKVObject: (...args: [string, unknown]) => mockSetMMKVObject(...args),
}));

jest.mock('@utils/fetch/fetch', () => ({
  fetchTimeout: (...args: unknown[]) => mockFetchTimeout(...args),
}));

const loadIssueIndex = () => require('../issueIndex');

const enabledRepository = (url: string, id = 1) => ({
  id,
  url,
  enabled: true,
});

const manifestUrl = (owner: string, repository: string, path = 'plugins/v4') =>
  `https://raw.githubusercontent.com/${owner}/${repository}/${path}/plugins.min.json`;

const issueIndexUrl = (owner: string, repository: string) =>
  `https://raw.githubusercontent.com/${owner}/${repository}/issue-index/issue-index.min.json`;

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

const cacheIndex = (index: unknown) => {
  mockStorage.set(PLUGIN_ISSUE_INDEX, JSON.stringify(index));
};

describe('plugin issue index', () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockGetMMKVObject.mockReset();
    mockGetMMKVObject.mockImplementation((key: string) => {
      const stored = mockStorage.get(key);
      return stored === undefined ? undefined : JSON.parse(stored);
    });
    mockSetMMKVObject.mockReset();
    mockSetMMKVObject.mockImplementation((key: string, value: unknown) => {
      mockStorage.set(key, JSON.stringify(value));
    });
    mockFetchTimeout.mockReset();
    mockGetEnabledRepositoriesFromDb.mockReset();
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([
      enabledRepository(defaultManifestUrl),
    ]);
  });

  it('keeps an unavailable index distinct from a loaded empty index when the configured source fails', async () => {
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    mockFetchTimeout.mockRejectedValue(new Error('network unavailable'));

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: undefined,
      isRefreshing: false,
      refreshFailed: false,
    });

    await expect(refreshPluginIssueIndex()).resolves.toBeUndefined();
    expect(pluginIssueIndexStore.getState()).toEqual({
      index: undefined,
      isRefreshing: false,
      refreshFailed: true,
    });
    expect(mockFetchTimeout.mock.calls).toEqual([
      [defaultIssueIndexUrl, PLUGIN_INDEX_HEADERS],
    ]);
  });

  it.each(['http', 'network', 'json', 'shape'])(
    'preserves the last complete cached snapshot when one configured source fails (%s)',
    async failure => {
      cacheIndex(issueIndexFixture);
      const { pluginIssueIndexStore, refreshPluginIssueIndex } =
        loadIssueIndex();
      const firstIssueIndexUrl = issueIndexUrl('example', 'source-a');
      const secondIssueIndexUrl = issueIndexUrl('example', 'source-b');
      const partialSnapshot = { partialplugin: [[4, 912]] };
      mockGetEnabledRepositoriesFromDb.mockResolvedValue([
        enabledRepository(manifestUrl('example', 'source-a'), 1),
        enabledRepository(manifestUrl('example', 'source-b'), 2),
      ]);
      mockFetchTimeout.mockImplementation((url: string) => {
        if (url === firstIssueIndexUrl) {
          return Promise.resolve(jsonResponse(partialSnapshot));
        }
        if (failure === 'http') {
          return Promise.resolve({ ok: false, status: 404, json: jest.fn() });
        }
        if (failure === 'network') {
          return Promise.reject(new Error('network unavailable'));
        }
        if (failure === 'json') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockRejectedValue(new SyntaxError('invalid JSON')),
          });
        }
        return Promise.resolve(jsonResponse({ galaxynovels: [[6, 0]] }));
      });

      await expect(refreshPluginIssueIndex()).resolves.toBeUndefined();

      expect(pluginIssueIndexStore.getState()).toEqual({
        index: issueIndexFixture,
        isRefreshing: false,
        refreshFailed: true,
      });
      expect(mockStorage.get(PLUGIN_ISSUE_INDEX)).toBe(
        JSON.stringify(issueIndexFixture),
      );
      expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
        firstIssueIndexUrl,
        secondIssueIndexUrl,
      ]);
      expect(mockFetchTimeout).toHaveBeenCalledTimes(2);
      expect(pluginIssueIndexStore.getState().index).not.toHaveProperty(
        'partialplugin',
      );
    },
  );

  it('hydrates the cached snapshot and refreshes it from the configured origin', async () => {
    cacheIndex(issueIndexFixture);
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    const refreshedIndexJson = {
      galaxynovels: [[5, 2133]],
      novelupdates: [[0, 729, 736]],
      emptyplugin: [],
    };
    const refreshedIndex: PluginIssueIndex = {
      galaxynovels: [[5, reportFor(2133)]],
      novelupdates: [[0, reportFor(729), reportFor(736)]],
      emptyplugin: [],
    };
    mockFetchTimeout.mockResolvedValue(jsonResponse(refreshedIndexJson));

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: issueIndexFixture,
      isRefreshing: false,
      refreshFailed: false,
    });

    await refreshPluginIssueIndex();

    expect(pluginIssueIndexStore.getState().index).toEqual(refreshedIndex);
    expect(pluginIssueIndexStore.getState().index?.novelupdates).toEqual([
      [0, reportFor(729), reportFor(736)],
    ]);
    expect(
      pluginIssueIndexStore.getState().index?.['GalaxyNovels'],
    ).toBeUndefined();
    expect(JSON.parse(mockStorage.get(PLUGIN_ISSUE_INDEX)!)).toEqual(
      refreshedIndex,
    );
    expect(mockFetchTimeout).toHaveBeenCalledWith(
      defaultIssueIndexUrl,
      PLUGIN_INDEX_HEADERS,
    );
  });

  it('derives the issue index from any configured GitHub owner and repository', async () => {
    const { refreshPluginIssueIndex } = loadIssueIndex();
    const configuredManifest =
      'https://raw.githubusercontent.com/galaxy-team/novel-sources/refs/heads/main/catalog/plugins.min.json?rev=1#manifest';
    const configuredIssueIndexUrl = issueIndexUrl(
      'galaxy-team',
      'novel-sources',
    );
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([
      enabledRepository(configuredManifest),
    ]);
    mockFetchTimeout.mockResolvedValue(jsonResponse(issueIndexJsonFixture));

    await refreshPluginIssueIndex();

    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      configuredIssueIndexUrl,
    ]);
    expect(mockFetchTimeout).not.toHaveBeenCalledWith(
      expect.stringContaining('/LNReader/lnreader-plugins/'),
      expect.anything(),
    );
    expect(mockFetchTimeout).not.toHaveBeenCalledWith(
      expect.stringContaining('/CD-Z/lnreader-sources/'),
      expect.anything(),
    );
  });

  it('persists decoded repository names from encoded manifest path segments', async () => {
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    const encodedManifest =
      'https://raw.githubusercontent.com/galaxy%2Dteam/novel%2Dsources/refs/heads/main/catalog/plugins.min.json';
    const configuredIssueIndexUrl =
      'https://raw.githubusercontent.com/galaxy%2Dteam/novel%2Dsources/issue-index/issue-index.min.json';
    const expectedIndex: PluginIssueIndex = {
      galaxynovels: [[6, reportFor(2133, 'galaxy-team', 'novel-sources')]],
    };
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([
      enabledRepository(encodedManifest),
    ]);
    mockFetchTimeout.mockResolvedValue(
      jsonResponse({ galaxynovels: [[6, 2133]] }),
    );

    await refreshPluginIssueIndex();

    expect(mockFetchTimeout).toHaveBeenCalledWith(
      configuredIssueIndexUrl,
      PLUGIN_INDEX_HEADERS,
    );
    expect(pluginIssueIndexStore.getState().index).toEqual(expectedIndex);
    expect(JSON.parse(mockStorage.get(PLUGIN_ISSUE_INDEX)!)).toEqual(
      expectedIndex,
    );
  });

  it('attaches reports to their source and preserves repository-order merging', async () => {
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    const firstIssueIndexUrl = issueIndexUrl('example', 'source-a');
    const secondIssueIndexUrl = issueIndexUrl('example', 'source-b');
    const firstSnapshot = {
      firstonly: [[1, 11]],
      shared: [
        [1, 111],
        [2, 222],
      ],
      sourceaissue: [[4, 42]],
      clearedbysecond: [[4, 444]],
    };
    const secondSnapshot = {
      secondonly: [[3, 33]],
      shared: [[6, 666]],
      sourcebissue: [[5, 42]],
      clearedbysecond: [],
    };
    const { promise: firstResponse, resolve: resolveFirst } =
      createDeferred<unknown>();
    const { promise: secondResponse, resolve: resolveSecond } =
      createDeferred<unknown>();
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([
      enabledRepository(manifestUrl('example', 'source-a'), 1),
      enabledRepository(manifestUrl('example', 'source-b'), 2),
    ]);
    mockFetchTimeout.mockImplementation((url: string) =>
      url === firstIssueIndexUrl ? firstResponse : secondResponse,
    );

    const refresh = refreshPluginIssueIndex();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      firstIssueIndexUrl,
      secondIssueIndexUrl,
    ]);

    resolveSecond(jsonResponse(secondSnapshot));
    await Promise.resolve();
    resolveFirst(jsonResponse(firstSnapshot));
    await refresh;

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: {
        firstonly: [[1, reportFor(11)]],
        secondonly: [[3, reportFor(33, 'example', 'source-b')]],
        shared: [[6, reportFor(666, 'example', 'source-b')]],
        sourceaissue: [[4, reportFor(42)]],
        sourcebissue: [[5, reportFor(42, 'example', 'source-b')]],
        clearedbysecond: [],
      },
      isRefreshing: false,
      refreshFailed: false,
    });
  });

  it('fetches duplicate derived URLs once and gives their last repository position precedence', async () => {
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    const sourceAUrl = issueIndexUrl('example', 'source-a');
    const sourceBUrl = issueIndexUrl('example', 'source-b');
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([
      enabledRepository(manifestUrl('example', 'source-a', 'plugins/v3'), 1),
      enabledRepository(manifestUrl('example', 'source-b', 'plugins/v2'), 2),
      enabledRepository(
        'https://raw.githubusercontent.com/example/source-a/refs/heads/main/plugins.min.json?rev=2',
        3,
      ),
    ]);
    mockFetchTimeout.mockImplementation((url: string) =>
      Promise.resolve(
        jsonResponse(
          url === sourceAUrl
            ? { shared: [[6, 66]], froma: [[1, 1]] }
            : { shared: [[2, 22]], fromb: [[3, 3]] },
        ),
      ),
    );

    await refreshPluginIssueIndex();

    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      sourceBUrl,
      sourceAUrl,
    ]);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(2);
    expect(pluginIssueIndexStore.getState().index).toEqual({
      shared: [[6, reportFor(66)]],
      fromb: [[3, reportFor(3, 'example', 'source-b')]],
      froma: [[1, reportFor(1)]],
    });
  });

  it('skips unsupported, malformed and local-file repository URLs', async () => {
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([
      enabledRepository('https://example.com/plugins.min.json', 1),
      enabledRepository('not a URL', 2),
      enabledRepository(
        'file:///raw.githubusercontent.com/example/source/plugins.min.json',
        3,
      ),
      enabledRepository(
        'https://raw.githubusercontent.com/example/source/plugins.json',
        4,
      ),
      enabledRepository(
        'https://raw.githubusercontent.com/example%2Fowner/source/plugins/v4/plugins.min.json',
        5,
      ),
    ]);
    mockFetchTimeout.mockResolvedValue(jsonResponse(issueIndexJsonFixture));

    await refreshPluginIssueIndex();

    expect(mockFetchTimeout).not.toHaveBeenCalled();
    expect(pluginIssueIndexStore.getState()).toEqual({
      index: {},
      isRefreshing: false,
      refreshFailed: false,
    });
    expect(JSON.parse(mockStorage.get(PLUGIN_ISSUE_INDEX)!)).toEqual({});
  });

  it('clears cached reports when no repositories are configured', async () => {
    cacheIndex(issueIndexFixture);
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    mockGetEnabledRepositoriesFromDb.mockResolvedValue([]);

    await refreshPluginIssueIndex();

    expect(mockFetchTimeout).not.toHaveBeenCalled();
    expect(pluginIssueIndexStore.getState()).toEqual({
      index: {},
      isRefreshing: false,
      refreshFailed: false,
    });
    expect(JSON.parse(mockStorage.get(PLUGIN_ISSUE_INDEX)!)).toEqual({});
  });

  it('keeps the cached snapshot and marks the refresh failed when repository lookup fails', async () => {
    cacheIndex(issueIndexFixture);
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    mockGetEnabledRepositoriesFromDb.mockRejectedValue(
      new Error('repository database unavailable'),
    );

    await expect(refreshPluginIssueIndex()).resolves.toBeUndefined();

    expect(mockFetchTimeout).not.toHaveBeenCalled();
    expect(pluginIssueIndexStore.getState()).toEqual({
      index: issueIndexFixture,
      isRefreshing: false,
      refreshFailed: true,
    });
    expect(mockStorage.get(PLUGIN_ISSUE_INDEX)).toBe(
      JSON.stringify(issueIndexFixture),
    );
  });

  it('supersedes an active request when repository lookup fails', async () => {
    cacheIndex(issueIndexFixture);
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    const { promise: response, resolve } = createDeferred<unknown>();
    mockGetEnabledRepositoriesFromDb
      .mockResolvedValueOnce([enabledRepository(defaultManifestUrl)])
      .mockRejectedValueOnce(new Error('repository database unavailable'));
    mockFetchTimeout.mockReturnValue(response);

    const activeRefresh = refreshPluginIssueIndex();
    await Promise.resolve();
    await Promise.resolve();
    await refreshPluginIssueIndex();

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: issueIndexFixture,
      isRefreshing: false,
      refreshFailed: true,
    });

    resolve(jsonResponse({ newer: [[1, 123]] }));
    await activeRefresh;

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: issueIndexFixture,
      isRefreshing: false,
      refreshFailed: true,
    });
    expect(mockStorage.get(PLUGIN_ISSUE_INDEX)).toBe(
      JSON.stringify(issueIndexFixture),
    );
    expect(mockSetMMKVObject).not.toHaveBeenCalled();
  });

  it('rejects an invalid cached shape without preventing a later successful fetch', async () => {
    cacheIndex({ galaxynovels: [[7, 2133]] });
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    mockFetchTimeout.mockResolvedValue(jsonResponse(issueIndexJsonFixture));

    expect(pluginIssueIndexStore.getState().index).toBeUndefined();

    await refreshPluginIssueIndex();

    expect(pluginIssueIndexStore.getState().index).toEqual(issueIndexFixture);
    expect(pluginIssueIndexStore.getState().refreshFailed).toBe(false);
  });

  it('does not assign a configured source to a legacy numeric cache', async () => {
    cacheIndex({ galaxynovels: [[6, 42]] });
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    mockFetchTimeout.mockRejectedValue(new Error('network unavailable'));

    expect(pluginIssueIndexStore.getState().index).toBeUndefined();

    await refreshPluginIssueIndex();

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: undefined,
      isRefreshing: false,
      refreshFailed: true,
    });
    expect(mockSetMMKVObject).not.toHaveBeenCalled();
  });

  it('ignores corrupt cached JSON and still fetches a valid snapshot', async () => {
    mockStorage.set(PLUGIN_ISSUE_INDEX, '{invalid json');
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    mockFetchTimeout.mockResolvedValue(jsonResponse(issueIndexJsonFixture));

    expect(pluginIssueIndexStore.getState().index).toBeUndefined();

    await refreshPluginIssueIndex();

    expect(pluginIssueIndexStore.getState().index).toEqual(issueIndexFixture);
    expect(pluginIssueIndexStore.getState().refreshFailed).toBe(false);
  });

  it('keeps the old snapshot when persistence fails', async () => {
    cacheIndex(issueIndexFixture);
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    const persistedBefore = mockStorage.get(PLUGIN_ISSUE_INDEX);
    mockFetchTimeout.mockResolvedValue(jsonResponse({ novelupdates: [] }));
    mockSetMMKVObject.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });

    await expect(refreshPluginIssueIndex()).resolves.toBeUndefined();

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: issueIndexFixture,
      isRefreshing: false,
      refreshFailed: true,
    });
    expect(mockStorage.get(PLUGIN_ISSUE_INDEX)).toBe(persistedBefore);
    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      defaultIssueIndexUrl,
    ]);
  });

  it('accepts an empty configured snapshot and clears cached reports', async () => {
    cacheIndex(issueIndexFixture);
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    mockFetchTimeout.mockResolvedValue(jsonResponse({}));

    await refreshPluginIssueIndex();

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: {},
      isRefreshing: false,
      refreshFailed: false,
    });
    expect(JSON.parse(mockStorage.get(PLUGIN_ISSUE_INDEX)!)).toEqual({});
    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      defaultIssueIndexUrl,
    ]);
  });

  it('suppresses a stale A result after a configuration change starts B', async () => {
    cacheIndex(issueIndexFixture);
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    const aUrl = issueIndexUrl('example', 'source-a');
    const bUrl = issueIndexUrl('example', 'source-b');
    const snapshotAJson = { galaxynovels: [[1, 101]] };
    const snapshotBJson = { galaxynovels: [[2, 202]] };
    const snapshotB: PluginIssueIndex = {
      galaxynovels: [[2, reportFor(202, 'example', 'source-b')]],
    };
    const { promise: responseA, resolve: resolveA } = createDeferred<unknown>();
    const { promise: responseB, resolve: resolveB } = createDeferred<unknown>();
    mockGetEnabledRepositoriesFromDb
      .mockResolvedValueOnce([
        enabledRepository(manifestUrl('example', 'source-a')),
      ])
      .mockResolvedValueOnce([
        enabledRepository(manifestUrl('example', 'source-b')),
      ]);
    mockFetchTimeout.mockImplementation((url: string) =>
      url === aUrl ? responseA : responseB,
    );

    const refreshA = refreshPluginIssueIndex();
    const refreshB = refreshPluginIssueIndex();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      aUrl,
      bUrl,
    ]);

    resolveB(jsonResponse(snapshotBJson));
    await refreshB;
    expect(pluginIssueIndexStore.getState().index).toEqual(snapshotB);
    expect(mockStorage.get(PLUGIN_ISSUE_INDEX)).toBe(JSON.stringify(snapshotB));

    resolveA(jsonResponse(snapshotAJson));
    await refreshA;

    expect(pluginIssueIndexStore.getState()).toEqual({
      index: snapshotB,
      isRefreshing: false,
      refreshFailed: false,
    });
    expect(mockStorage.get(PLUGIN_ISSUE_INDEX)).toBe(JSON.stringify(snapshotB));
    expect(mockSetMMKVObject.mock.calls.map(([, index]) => index)).toEqual([
      snapshotB,
    ]);
  });

  it('coalesces same-source refreshes and allows a later retry after failure', async () => {
    const { pluginIssueIndexStore, refreshPluginIssueIndex } = loadIssueIndex();
    const { promise: failedResponse, resolve: resolveFailure } =
      createDeferred<unknown>();
    mockFetchTimeout
      .mockReturnValueOnce(failedResponse)
      .mockResolvedValueOnce(jsonResponse(issueIndexJsonFixture));

    const firstRefresh = refreshPluginIssueIndex();
    const overlappingRefresh = refreshPluginIssueIndex();
    await Promise.resolve();
    await Promise.resolve();

    expect(pluginIssueIndexStore.getState().isRefreshing).toBe(true);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(1);

    resolveFailure({ ok: false, status: 404, json: jest.fn() });
    await Promise.all([firstRefresh, overlappingRefresh]);

    expect(pluginIssueIndexStore.getState().refreshFailed).toBe(true);
    await refreshPluginIssueIndex();

    expect(mockFetchTimeout).toHaveBeenCalledTimes(2);
    expect(pluginIssueIndexStore.getState()).toEqual({
      index: issueIndexFixture,
      isRefreshing: false,
      refreshFailed: false,
    });
  });
});
