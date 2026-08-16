import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import debounce from 'lodash-es/debounce';

import { NovelItem, PluginItem } from '@plugins/types';
import { getPlugin } from '@plugins/pluginManager';
import {
  useBrowseSettings,
  useFilteredInstalledPlugins,
} from '@hooks/persisted';
import { useFocusEffect } from '@react-navigation/native';
import { resolveSharedUrl } from '@services/share/resolveSharedUrl';

interface Props {
  defaultSearchText?: string;
  hasResultsOnly?: boolean;
}

export interface GlobalSearchResult {
  isLoading: boolean;
  plugin: PluginItem;
  novels: NovelItem[];
  error?: string | null;
}

export const useGlobalSearch = ({
  defaultSearchText,
  hasResultsOnly = false,
}: Props) => {
  const isMounted = useRef(true); //if user closes the search screen, cancel the search
  const isFocused = useRef(true); //if the user opens a sub-screen (e.g. novel screen), pause the search
  const lastSearch = useRef(''); //if the user changes search, cancel running searches
  useEffect(
    () => () => {
      isMounted.current = false;
    },
    [],
  );
  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;

      return () => (isFocused.current = false);
    }, []),
  );

  const filteredInstalledPlugins = useFilteredInstalledPlugins();

  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [progress, setProgress] = useState(0);

  const { globalSearchConcurrency = 1 } = useBrowseSettings();

  const globalSearch = useCallback(
    (searchText: string) => {
      if (lastSearch.current === searchText) {
        return;
      }
      lastSearch.current = searchText;
      const defaultResult: GlobalSearchResult[] = filteredInstalledPlugins.map(
        plugin => ({
          isLoading: true,
          plugin,
          novels: [],
          error: null,
        }),
      );

      setSearchResults(defaultResult.sort(novelResultSorter));
      setProgress(0);

      let running = 0;

      async function searchInPlugin(_plugin: PluginItem) {
        try {
          const plugin = getPlugin(_plugin.id);
          if (!plugin) {
            throw new Error(`Unknown plugin: ${_plugin.id}`);
          }
          const res = await plugin.searchNovels(searchText, 1);

          setSearchResults(prevState =>
            prevState
              .map(prevResult =>
                prevResult.plugin.id === plugin.id
                  ? { ...prevResult, novels: res, isLoading: false }
                  : { ...prevResult },
              )
              .sort(novelResultSorter),
          );
        } catch (error: any) {
          const errorMessage = error?.message || String(error);
          setSearchResults(prevState =>
            prevState
              .map(prevResult =>
                prevResult.plugin.id === _plugin.id
                  ? {
                      ...prevResult,
                      novels: [],
                      isLoading: false,
                      error: errorMessage,
                    }
                  : { ...prevResult },
              )
              .sort(novelResultSorter),
          );
        }
      }

      //Sort so we load the plugins results in the same order as they show on the list
      const filteredSortedInstalledPlugins = [...filteredInstalledPlugins].sort(
        (a, b) => a.name.localeCompare(b.name),
      );

      (async () => {
        if (globalSearchConcurrency > 1) {
          for (const _plugin of filteredSortedInstalledPlugins) {
            while (running >= globalSearchConcurrency || !isFocused.current) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (!isMounted.current || lastSearch.current !== searchText) {
              break;
            }
            running++;
            searchInPlugin(_plugin)
              .then(() => {
                running--;
                if (lastSearch.current === searchText) {
                  setProgress(
                    prevState =>
                      prevState + 1 / filteredInstalledPlugins.length,
                  );
                }
              })
              .catch(() => {
                running--;
              });
          }
        } else {
          for (const _plugin of filteredSortedInstalledPlugins) {
            if (!isMounted.current || lastSearch.current !== searchText) {
              break;
            }
            while (!isFocused.current) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            await searchInPlugin(_plugin);
            if (lastSearch.current === searchText) {
              setProgress(
                prevState => prevState + 1 / filteredInstalledPlugins.length,
              );
            }
          }
        }
      })();
    },
    [filteredInstalledPlugins, globalSearchConcurrency],
  );

  const debouncedGlobalSearch = useMemo(
    () => debounce(globalSearch, 300), // eslint-disable-line react-hooks/refs
    [globalSearch],
  );

  useEffect(() => {
    if (defaultSearchText) {
      // URL text is handled by the screen's explicit submit flow
      // (button / keyboard submit); never search or navigate for it.
      const sharedUrlResult = resolveSharedUrl(defaultSearchText);
      if (!sharedUrlResult) {
        debouncedGlobalSearch(defaultSearchText);
      }
    }

    return () => {
      debouncedGlobalSearch.cancel();
    };
  }, [defaultSearchText, debouncedGlobalSearch]);

  const filteredSearchResults = useMemo(() => {
    if (!hasResultsOnly) {
      return searchResults;
    }
    return searchResults.filter(
      result => !result.isLoading && !result.error && result.novels.length > 0,
    );
  }, [searchResults, hasResultsOnly]);

  return { searchResults: filteredSearchResults, globalSearch, progress };
};

function novelResultSorter(
  { novels: a, plugin: { name: aName } }: GlobalSearchResult,
  { novels: b, plugin: { name: bName } }: GlobalSearchResult,
) {
  if (!a.length && !b.length) {
    return aName.localeCompare(bName);
  }
  if (!a.length) {
    return 1;
  }
  if (!b.length) {
    return -1;
  }

  return aName.localeCompare(bName);
}
