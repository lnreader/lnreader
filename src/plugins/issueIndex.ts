import { createStore, type StoreApi } from 'zustand';

import { getEnabledRepositoriesFromDb } from '@database/queries/RepositoryQueries';

import { fetchTimeout } from '@utils/fetch/fetch';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';

export type PluginIssueCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type PluginIssueRepository = { owner: string; name: string };
export type PluginIssueReport = {
  issueNumber: number;
  repository: PluginIssueRepository;
};
export type PluginIssueGroup = [PluginIssueCategory, ...PluginIssueReport[]];
export type PluginIssueIndex = Record<string, PluginIssueGroup[]>;

export interface PluginIssueIndexState {
  index: PluginIssueIndex | undefined;
  isRefreshing: boolean;
  refreshFailed: boolean;
}

const issueIndexStorageKey = 'PLUGIN_ISSUE_INDEX';

interface PluginIssueIndexSource {
  url: string;
  repository: PluginIssueRepository;
}

const decodeRepositoryPathSegment = (segment: string): string | undefined => {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded &&
      decoded !== '.' &&
      decoded !== '..' &&
      !/[\/\\?#%]/.test(decoded)
      ? decoded
      : undefined;
  } catch {
    return undefined;
  }
};

const getIssueIndexSource = (
  repositoryUrl: string,
): PluginIssueIndexSource | undefined => {
  try {
    const manifestUrl = new URL(repositoryUrl);
    const pathSegments = manifestUrl.pathname.split('/').filter(Boolean);
    const encodedOwner = pathSegments[0];
    const encodedName = pathSegments[1];
    const owner = encodedOwner && decodeRepositoryPathSegment(encodedOwner);
    const name = encodedName && decodeRepositoryPathSegment(encodedName);
    if (
      !['http:', 'https:'].includes(manifestUrl.protocol) ||
      manifestUrl.hostname !== 'raw.githubusercontent.com' ||
      pathSegments.length < 4 ||
      !encodedOwner ||
      !encodedName ||
      !owner ||
      !name ||
      pathSegments[pathSegments.length - 1] !== 'plugins.min.json'
    ) {
      return undefined;
    }

    const issueIndexUrl = new URL(manifestUrl.origin);
    issueIndexUrl.pathname = `/${encodedOwner}/${encodedName}/issue-index/issue-index.min.json`;
    return {
      url: issueIndexUrl.toString(),
      repository: { owner, name },
    };
  } catch {
    return undefined;
  }
};

const getConfiguredIssueIndexSources = async (): Promise<
  PluginIssueIndexSource[]
> => {
  const repositories = await getEnabledRepositoriesFromDb();
  const sources = repositories
    .map(repository => getIssueIndexSource(repository.url))
    .filter((source): source is PluginIssueIndexSource => source !== undefined);
  const seen = new Set<string>();
  return sources
    .reverse()
    .filter(source => {
      if (seen.has(source.url)) {
        return false;
      }
      seen.add(source.url);
      return true;
    })
    .reverse();
};

const fetchIssueIndex = async (
  source: PluginIssueIndexSource,
): Promise<PluginIssueIndex> => {
  const response = await fetchTimeout(source.url, {
    headers: { pragma: 'no-cache', 'cache-control': 'no-cache' },
  });
  if (!response.ok) {
    throw new Error(`Plugin issue index request failed: ${response.status}`);
  }

  const index: unknown = await response.json();
  if (!isRawPluginIssueIndex(index)) {
    throw new Error('Plugin issue index response has an invalid shape');
  }

  return Object.fromEntries(
    Object.entries(index).map(([pluginId, groups]) => [
      pluginId,
      groups.map(
        (group): PluginIssueGroup => [
          group[0],
          ...group.slice(1).map(issueNumber => ({
            issueNumber,
            repository: source.repository,
          })),
        ],
      ),
    ]),
  );
};

type RawPluginIssueGroup = [PluginIssueCategory, number, ...number[]];
type RawPluginIssueIndex = Record<string, RawPluginIssueGroup[]>;

const isRawPluginIssueIndex = (
  value: unknown,
): value is RawPluginIssueIndex => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  for (const pluginId of Object.keys(value)) {
    const groups = (value as Record<string, unknown>)[pluginId];
    if (!Array.isArray(groups)) {
      return false;
    }

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      if (!Array.isArray(group) || group.length < 2) {
        return false;
      }

      const category = group[0];
      if (
        typeof category !== 'number' ||
        !Number.isInteger(category) ||
        category < 0 ||
        category > 6
      ) {
        return false;
      }

      for (let issueIndex = 1; issueIndex < group.length; issueIndex++) {
        const issueNumber = group[issueIndex];
        if (
          typeof issueNumber !== 'number' ||
          !Number.isSafeInteger(issueNumber) ||
          issueNumber <= 0
        ) {
          return false;
        }
      }
    }
  }

  return true;
};

const isPluginIssueIndex = (value: unknown): value is PluginIssueIndex => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  for (const pluginId of Object.keys(value)) {
    const groups = (value as Record<string, unknown>)[pluginId];
    if (!Array.isArray(groups)) {
      return false;
    }

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      if (!Array.isArray(group) || group.length < 2) {
        return false;
      }

      const category = group[0];
      if (
        typeof category !== 'number' ||
        !Number.isInteger(category) ||
        category < 0 ||
        category > 6
      ) {
        return false;
      }

      for (let issueIndex = 1; issueIndex < group.length; issueIndex++) {
        const report = group[issueIndex];
        if (
          typeof report !== 'object' ||
          report === null ||
          Array.isArray(report)
        ) {
          return false;
        }

        const issueNumber = (report as PluginIssueReport).issueNumber;
        const repository = (report as PluginIssueReport).repository;
        if (
          typeof issueNumber !== 'number' ||
          !Number.isSafeInteger(issueNumber) ||
          issueNumber <= 0 ||
          typeof repository !== 'object' ||
          repository === null ||
          Array.isArray(repository) ||
          typeof (repository as PluginIssueRepository).owner !== 'string' ||
          (repository as PluginIssueRepository).owner.length === 0 ||
          typeof (repository as PluginIssueRepository).name !== 'string' ||
          (repository as PluginIssueRepository).name.length === 0
        ) {
          return false;
        }
      }
    }
  }

  return true;
};

const readCachedIndex = (): PluginIssueIndex | undefined => {
  try {
    const cachedIndex = getMMKVObject<unknown>(issueIndexStorageKey);
    return isPluginIssueIndex(cachedIndex) ? cachedIndex : undefined;
  } catch {
    return undefined;
  }
};

export const pluginIssueIndexStore: StoreApi<PluginIssueIndexState> =
  createStore<PluginIssueIndexState>()(() => ({
    index: readCachedIndex(),
    isRefreshing: false,
    refreshFailed: false,
  }));

interface ActiveRefresh {
  key: string;
  promise: Promise<void>;
}

let activeRefresh: ActiveRefresh | undefined;

const refreshIssueIndex = async (
  sources: PluginIssueIndexSource[],
  refresh: ActiveRefresh,
): Promise<void> => {
  pluginIssueIndexStore.setState({ isRefreshing: true, refreshFailed: false });

  try {
    const results = await Promise.allSettled(sources.map(fetchIssueIndex));
    if (activeRefresh !== refresh) {
      return;
    }
    if (results.some(result => result.status === 'rejected')) {
      throw new Error('A configured plugin issue index request failed');
    }

    const index: PluginIssueIndex = Object.create(null);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        Object.assign(index, result.value);
      }
    }

    setMMKVObject(issueIndexStorageKey, index);
    if (activeRefresh === refresh) {
      pluginIssueIndexStore.setState({ index, refreshFailed: false });
    }
  } catch {
    if (activeRefresh === refresh) {
      pluginIssueIndexStore.setState({ refreshFailed: true });
    }
  } finally {
    if (activeRefresh === refresh) {
      pluginIssueIndexStore.setState({ isRefreshing: false });
      activeRefresh = undefined;
    }
  }
};

export const refreshPluginIssueIndex = async (): Promise<void> => {
  let sources: PluginIssueIndexSource[];
  try {
    sources = await getConfiguredIssueIndexSources();
  } catch {
    activeRefresh = undefined;
    pluginIssueIndexStore.setState({
      isRefreshing: false,
      refreshFailed: true,
    });
    return;
  }

  const key = JSON.stringify(sources.map(source => source.url));
  if (activeRefresh?.key === key) {
    return activeRefresh.promise;
  }

  const refresh = { key, promise: Promise.resolve() };
  activeRefresh = refresh;
  refresh.promise = refreshIssueIndex(sources, refresh);
  return refresh.promise;
};
