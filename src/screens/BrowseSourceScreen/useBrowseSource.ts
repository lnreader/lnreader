import { useState, useEffect, useCallback, useRef } from 'react';
import { NovelItem } from '@plugins/types';

import { getPlugin } from '@plugins/pluginManager';
import { FilterToValues, Filters } from '@plugins/types/filterTypes';

export const useBrowseSource = (
  pluginId: string,
  showLatestNovels?: boolean,
) => {
  const [isLoading, setIsLoading] = useState(true);
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [error, setError] = useState<string>();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Filters | undefined>(
    getPlugin(pluginId)?.filters,
  );
  const [selectedFilters, setSelectedFilters] = useState<
    FilterToValues<Filters> | undefined
  >(filterValues);
  const [hasNextPage, setHasNextPage] = useState(true);

  const isScreenMounted = useRef(true);

  // Serialize page fetches: onEndReached bursts (threshold 1.5 with a short
  // list) can bump currentPage several times before the first request settles.
  // Without a queue, that spawns concurrent out-of-order page fetches — each
  // append re-renders the whole grid and remounts the "loading more" shimmer
  // cells, which reads as stutter while scrolling the source list.
  const fetchQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Bumped whenever the list is reset to page 1 (refetch, filters); queued
  // fetches from an older generation are discarded so they cannot append
  // stale pages onto a fresh list.
  const generationRef = useRef(0);
  // Highest page whose items are in the list, and highest page requested.
  // `fetchNextPage` always asks for `lastLoaded + 1`, so a failed/empty
  // fetch is retried on the next approach instead of being skipped past.
  const lastLoadedPageRef = useRef(0);
  const requestedPageRef = useRef(1);

  const fetchNovels = useCallback(
    (page: number, filters?: FilterToValues<Filters>) => {
      const run = async () => {
        if (!isScreenMounted.current) {
          return;
        }
        const generation = generationRef.current;
        try {
          const plugin = getPlugin(pluginId);
          if (!plugin) {
            throw new Error(`Unknown plugin: ${pluginId}`);
          }
          const res = await plugin.popularNovels(page, {
            showLatestNovels,
            filters,
          });
          if (generation !== generationRef.current) {
            return;
          }
          setNovels(prevState => (page === 1 ? res : [...prevState, ...res]));
          lastLoadedPageRef.current = Math.max(lastLoadedPageRef.current, page);
          if (!res.length) {
            setHasNextPage(false);
          }
          setFilterValues(plugin.filters);
        } catch (err: unknown) {
          if (generation !== generationRef.current) {
            return;
          }
          setError(err instanceof Error ? err.message : `${err}`);
          // A failed page fetch must not permanently end the list: sources
          // rate-limit and transient network errors are common, and once
          // `hasNextPage` flips false nothing ever retries (the screen stays
          // mounted behind the reader, so the dead state persists even after
          // navigating away and back). Un-request the failed page so the next
          // approach retries it; only a successful empty response marks the end.
          requestedPageRef.current = Math.min(
            requestedPageRef.current,
            page - 1,
          );
        } finally {
          if (generation === generationRef.current) {
            setIsLoading(false);
          }
        }
      };
      fetchQueueRef.current = fetchQueueRef.current.then(run, run);
      return fetchQueueRef.current;
    },
    [pluginId, showLatestNovels],
  );

  const fetchNextPage = () => {
    if (!hasNextPage) {
      return;
    }
    const next = lastLoadedPageRef.current + 1;
    if (next <= requestedPageRef.current) {
      return;
    }
    requestedPageRef.current = next;
    void fetchNovels(next, selectedFilters);
  };

  /**
   * On screen unmount
   */
  useEffect(() => {
    return () => {
      isScreenMounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchNovels(currentPage, selectedFilters);
  }, [fetchNovels, currentPage, selectedFilters]);

  const refetchNovels = () => {
    generationRef.current += 1;
    setError('');
    setIsLoading(true);
    setNovels([]);
    setCurrentPage(1);
    lastLoadedPageRef.current = 0;
    requestedPageRef.current = 1;
    fetchNovels(1, selectedFilters);
  };

  const clearFilters = useCallback(
    (filters: Filters) => setSelectedFilters(filters),
    [],
  );

  const setFilters = (filters?: FilterToValues<Filters>) => {
    generationRef.current += 1;
    setIsLoading(true);
    setCurrentPage(1);
    lastLoadedPageRef.current = 0;
    requestedPageRef.current = 1;
    fetchNovels(1, filters);
    setSelectedFilters(filters);
  };

  return {
    isLoading,
    novels,
    hasNextPage,
    fetchNextPage,
    error,
    filterValues,
    setFilters,
    clearFilters,
    refetchNovels,
  };
};

export const useSearchSource = (pluginId: string) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NovelItem[]>([]);
  const [searchError, setSearchError] = useState<string>();
  const [hasNextSearchPage, setHasNextSearchPage] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');

  const searchSource = (searchTerm: string) => {
    searchGenerationRef.current += 1;
    setSearchResults([]);
    setHasNextSearchPage(true);
    setCurrentPage(1);
    lastLoadedPageRef.current = 0;
    requestedPageRef.current = 1;
    setSearchText(searchTerm);
    setIsSearching(true);
  };

  const isScreenMounted = useRef(true);

  // Serialize page fetches — see useBrowseSource.fetchNovels for why.
  const fetchQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Bumped whenever a new search starts; queued fetches from a previous
  // search are discarded so they cannot append stale results onto a new one.
  const searchGenerationRef = useRef(0);
  // Same last-loaded/requested page tracking as useBrowseSource so failed
  // pages are retried instead of skipped.
  const lastLoadedPageRef = useRef(0);
  const requestedPageRef = useRef(1);

  const fetchNovels = useCallback(
    (localSearchText: string, page: number) => {
      const run = async () => {
        if (!isScreenMounted.current) {
          return;
        }
        const generation = searchGenerationRef.current;
        try {
          const plugin = getPlugin(pluginId);
          if (!plugin) {
            throw new Error(`Unknown plugin: ${pluginId}`);
          }
          const res = await plugin.searchNovels(localSearchText, page);
          if (generation !== searchGenerationRef.current) {
            return;
          }
          setSearchResults(prevState =>
            page === 1 ? res : [...prevState, ...res],
          );
          lastLoadedPageRef.current = Math.max(lastLoadedPageRef.current, page);
          if (!res.length) {
            setHasNextSearchPage(false);
          }
        } catch (err: unknown) {
          if (generation !== searchGenerationRef.current) {
            return;
          }
          setSearchError(`${err}`);
          // See fetchNovels: a transient failure must not permanently end
          // pagination; un-request the failed page so the next approach
          // retries it.
          requestedPageRef.current = Math.min(
            requestedPageRef.current,
            page - 1,
          );
        } finally {
          if (generation === searchGenerationRef.current) {
            setIsSearching(false);
          }
        }
      };
      fetchQueueRef.current = fetchQueueRef.current.then(run, run);
      return fetchQueueRef.current;
    },
    [pluginId],
  );

  const searchNextPage = () => {
    if (!hasNextSearchPage) {
      return;
    }
    const next = lastLoadedPageRef.current + 1;
    if (next <= requestedPageRef.current) {
      return;
    }
    requestedPageRef.current = next;
    void fetchNovels(searchText, next);
  };

  useEffect(() => {
    if (searchText) {
      fetchNovels(searchText, currentPage);
    }
  }, [currentPage, fetchNovels, searchText]);

  const clearSearchResults = useCallback(() => {
    setSearchText('');
    setSearchResults([]);
    setCurrentPage(1);
    setHasNextSearchPage(true);
    lastLoadedPageRef.current = 0;
    requestedPageRef.current = 1;
  }, []);

  return {
    isSearching,
    searchResults,
    hasNextSearchPage,
    searchNextPage,
    searchSource,
    clearSearchResults,
    searchError,
  };
};
