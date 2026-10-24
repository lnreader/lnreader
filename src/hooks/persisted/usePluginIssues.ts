import { useStore } from 'zustand';

import {
  pluginIssueIndexStore,
  type PluginIssueCategory,
  type PluginIssueGroup,
} from '@plugins/issueIndex';

const emptyGroups: PluginIssueGroup[] = [];

export function usePluginIssueCategory(
  pluginId: string,
): PluginIssueCategory | undefined {
  return useStore(pluginIssueIndexStore, state => {
    const { index } = state;
    if (
      index === undefined ||
      !Object.prototype.hasOwnProperty.call(index, pluginId)
    ) {
      return undefined;
    }

    return index[pluginId][0]?.[0];
  });
}

export function usePluginIssues(pluginId: string): {
  groups: PluginIssueGroup[] | undefined;
  isRefreshing: boolean;
  refreshFailed: boolean;
} {
  const groups = useStore(pluginIssueIndexStore, state => {
    const { index } = state;
    if (index === undefined) {
      return undefined;
    }

    return Object.prototype.hasOwnProperty.call(index, pluginId)
      ? index[pluginId]
      : emptyGroups;
  });
  const isRefreshing = useStore(
    pluginIssueIndexStore,
    state => state.isRefreshing,
  );
  const refreshFailed = useStore(
    pluginIssueIndexStore,
    state => state.refreshFailed,
  );

  return { groups, isRefreshing, refreshFailed };
}
