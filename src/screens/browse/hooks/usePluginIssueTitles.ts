import { useEffect, useState } from 'react';

import {
  getCachedPluginIssueTitle,
  getPluginIssueTitleCacheKey,
  loadPluginIssueTitle,
} from '@plugins/issueMetadata';
import type { PluginIssueGroup, PluginIssueReport } from '@plugins/issueIndex';

type IssueTitleResults = Map<string, string | null>;

type IssueTitleState = {
  groups: PluginIssueGroup[] | undefined;
  results: IssueTitleResults;
};

export function usePluginIssueTitles(
  groups: PluginIssueGroup[] | undefined,
): ReadonlyMap<PluginIssueReport, string | null | undefined> {
  const [state, setState] = useState<IssueTitleState>({
    groups: undefined,
    results: new Map(),
  });

  const reports = (groups ?? []).flatMap(([, ...groupReports]) => groupReports);
  const currentResults = state.groups === groups ? state.results : undefined;
  const titles = new Map<PluginIssueReport, string | null | undefined>();
  for (const report of reports) {
    titles.set(
      report,
      getCachedPluginIssueTitle(report.repository, report.issueNumber) ??
        currentResults?.get(
          getPluginIssueTitleCacheKey(report.repository, report.issueNumber),
        ),
    );
  }

  useEffect(() => {
    let active = true;
    const seenReportKeys = new Set<string>();
    const uncachedReports = (groups ?? [])
      .flatMap(([, ...groupReports]) => groupReports)
      .filter(report => {
        const cacheKey = getPluginIssueTitleCacheKey(
          report.repository,
          report.issueNumber,
        );
        if (seenReportKeys.has(cacheKey)) {
          return false;
        }
        seenReportKeys.add(cacheKey);
        return (
          getCachedPluginIssueTitle(report.repository, report.issueNumber) ===
          undefined
        );
      });
    let cursor = 0;

    const loadNext = async () => {
      while (active && cursor < uncachedReports.length) {
        const report = uncachedReports[cursor++];
        const cacheKey = getPluginIssueTitleCacheKey(
          report.repository,
          report.issueNumber,
        );
        let title: string | null;
        try {
          title =
            (await loadPluginIssueTitle(
              report.repository,
              report.issueNumber,
            )) ?? null;
        } catch {
          title = null;
        }

        if (active) {
          setState(current => {
            if (!active) {
              return current;
            }

            const results =
              current.groups === groups
                ? new Map(current.results)
                : new Map<string, string | null>();
            results.set(cacheKey, title);
            return { groups, results };
          });
        }
      }
    };

    const workerCount = Math.min(6, uncachedReports.length);
    for (let worker = 0; worker < workerCount; worker++) {
      void loadNext();
    }

    return () => {
      active = false;
    };
  }, [groups]);

  return titles;
}
