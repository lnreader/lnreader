import { useCallback, useEffect, useRef, useState } from 'react';
import { NovelItem } from '@plugins/types';
import { getPlugin } from '@plugins/pluginManager';
import { FilterToValues, Filters } from '@plugins/types/filterTypes';
import { getErrorMessage } from '@utils/error';

interface SourcePage<Params> {
  params: Params;
  novels: NovelItem[];
  nextPage: number | null;
  isLoading: boolean;
  error?: string;
}

const useSourcePages = <Params>(
  loadPage: (params: Params, page: number) => Promise<NovelItem[]>,
) => {
  const [page, setPage] = useState<SourcePage<Params> | null>(null);
  const activePage = useRef<SourcePage<Params> | null>(null);

  const fetchPage = useCallback(
    async (previous: SourcePage<Params>, pageNumber: number) => {
      // Set the request synchronously to guard against multiple scroll events
      // or retry taps before React renders the loading state.
      const request = { ...previous, isLoading: true, error: undefined };
      activePage.current = request;
      setPage(request);

      let settled: SourcePage<Params>;
      try {
        const novels = await loadPage(request.params, pageNumber);
        settled = {
          ...request,
          novels: [...request.novels, ...novels],
          nextPage: novels.length ? pageNumber + 1 : null,
          isLoading: false,
        };
      } catch (error) {
        settled = {
          ...request,
          error: getErrorMessage(error),
          isLoading: false,
        };
      }

      // A new search, filter change, or clear can supersede this request.
      if (activePage.current === request) {
        activePage.current = settled;
        setPage(settled);
      }
    },
    [loadPage],
  );

  const start = useCallback(
    (params: Params) =>
      fetchPage({ params, novels: [], nextPage: 1, isLoading: false }, 1),
    [fetchPage],
  );

  const clear = useCallback(() => {
    activePage.current = null;
    setPage(null);
  }, []);

  useEffect(
    () => () => {
      activePage.current = null;
    },
    [loadPage],
  );

  const fetchNextPage = () => {
    const current = activePage.current;
    if (
      current === page &&
      current?.nextPage != null &&
      !current.isLoading &&
      current.error === undefined
    ) {
      void fetchPage(current, current.nextPage);
    }
  };

  const retryPage = () => {
    const current = activePage.current;
    if (
      current?.nextPage != null &&
      !current.isLoading &&
      current.error !== undefined
    ) {
      void fetchPage(current, current.nextPage);
    }
  };

  return { page, start, clear, fetchNextPage, retryPage };
};

export const useBrowseSource = (
  pluginId: string,
  showLatestNovels?: boolean,
) => {
  const loadPage = useCallback(
    async (filters: FilterToValues<Filters> | undefined, page: number) => {
      const plugin = getPlugin(pluginId);
      if (!plugin) {
        throw new Error(`Unknown plugin: ${pluginId}`);
      }
      return plugin.popularNovels(page, { showLatestNovels, filters });
    },
    [pluginId, showLatestNovels],
  );

  const { page, start, fetchNextPage, retryPage } = useSourcePages(loadPage);
  const filterValues = getPlugin(pluginId)?.filters;

  useEffect(() => {
    void start(getPlugin(pluginId)?.filters);
  }, [pluginId, start]);

  const setFilters = (filters?: FilterToValues<Filters>) => {
    void start(filters);
  };

  const clearFilters = (filters: Filters) => {
    if (page?.params !== filters) {
      void start(filters);
    }
  };

  return {
    page,
    fetchNextPage,
    retryPage,
    filterValues,
    setFilters,
    clearFilters,
  };
};

export const useSearchSource = (pluginId: string) => {
  const loadPage = useCallback(
    async (query: string, page: number) => {
      const plugin = getPlugin(pluginId);
      if (!plugin) {
        throw new Error(`Unknown plugin: ${pluginId}`);
      }
      return plugin.searchNovels(query, page);
    },
    [pluginId],
  );

  const { page, start, clear, fetchNextPage, retryPage } =
    useSourcePages(loadPage);

  const searchSource = (query: string) => {
    if (query === page?.params && page.isLoading) {
      return;
    }
    if (query === page?.params && page.error !== undefined) {
      retryPage();
    } else if (query.trim()) {
      void start(query);
    } else {
      clear();
    }
  };

  return {
    page,
    searchSource,
    clearSearchResults: clear,
    fetchNextPage,
    retryPage,
  };
};
