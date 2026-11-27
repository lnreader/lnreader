import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  getLibraryNovelKeysFromDb,
  getLibraryNovelsFromDb,
  getLibraryNovelsQuery,
} from '@database/queries/LibraryQueries';
import { getCategoriesFromDb } from '@database/queries/CategoryQueries';
import { NovelInfo } from '@database/types';
import { useLiveQuery } from '@database/manager/liveQuery';
import { useLibrarySettings } from '@hooks/persisted';
import {
  getNovelByPath,
  switchNovelToLibraryQuery,
} from '@database/queries/NovelQueries';
import { useLibrary } from '../useLibrary';

jest.mock('@hooks/persisted', () => ({
  useLibrarySettings: jest.fn(() => ({
    filters: {},
    sortOrder: 'name ASC',
    downloadedOnlyMode: false,
  })),
}));

jest.mock('@database/queries/LibraryQueries', () => ({
  getLibraryNovelsFromDb: jest.fn().mockResolvedValue([]),
  getLibraryNovelsQuery: jest.fn(() => ({ query: 'library' })),
  getLibraryNovelKeysFromDb: jest.fn().mockResolvedValue([]),
  getLibraryNovelKeysQuery: jest.fn(() => ({ query: 'keys' })),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  getCategoriesFromDb: jest.fn().mockResolvedValue([]),
}));

jest.mock('@database/queries/NovelQueries', () => ({
  getNovelByPath: jest.fn(),
  switchNovelToLibraryQuery: jest.fn(),
}));

jest.mock('@database/manager/liveQuery', () => ({
  useLiveQuery: jest.fn(),
}));

jest.mock('@services/backgroundTasks', () => ({
  getDownloadProgressKey: jest.fn(() => ''),
}));

jest.mock('@hooks/persisted/useBackgroundTasks', () => ({
  useBackgroundTasks: (selector: (tasks: unknown[]) => unknown) => selector([]),
  useBackgroundTaskQueue: () => [],
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn(),
    set: jest.fn(),
  }),
}));

const mockGetLibraryNovelsQuery = getLibraryNovelsQuery as jest.MockedFunction<
  typeof getLibraryNovelsQuery
>;
const mockUseLiveQuery = useLiveQuery as jest.MockedFunction<
  typeof useLiveQuery
>;
const mockGetLibraryNovelsFromDb =
  getLibraryNovelsFromDb as jest.MockedFunction<typeof getLibraryNovelsFromDb>;
const mockGetLibraryNovelKeysFromDb =
  getLibraryNovelKeysFromDb as jest.MockedFunction<
    typeof getLibraryNovelKeysFromDb
  >;
const mockGetCategoriesFromDb = getCategoriesFromDb as jest.MockedFunction<
  typeof getCategoriesFromDb
>;
const mockUseFocusEffect = useFocusEffect as jest.MockedFunction<
  typeof useFocusEffect
>;
const mockUseLibrarySettings = useLibrarySettings as jest.MockedFunction<
  typeof useLibrarySettings
>;
const mockGetNovelByPath = getNovelByPath as jest.MockedFunction<
  typeof getNovelByPath
>;
const mockSwitchNovelToLibraryQuery =
  switchNovelToLibraryQuery as jest.MockedFunction<
    typeof switchNovelToLibraryQuery
  >;

const captureLiveQueries = () => {
  const callbacks: Record<string, (rows: unknown[]) => void> = {};
  mockUseLiveQuery.mockImplementation((query, fireOn, callback) => {
    expect(fireOn).toEqual([{ table: 'Novel' }]);
    callbacks[(query as unknown as { query: string }).query] = callback as (
      rows: unknown[],
    ) => void;
    return [];
  });
  return callbacks;
};

describe('useLibrary', () => {
  beforeEach(() => {
    mockGetNovelByPath.mockClear();
    mockSwitchNovelToLibraryQuery.mockClear();
    mockUseLibrarySettings.mockReturnValue({
      filters: {},
      sortOrder: 'name ASC',
      downloadedOnlyMode: false,
    } as ReturnType<typeof useLibrarySettings>);
    mockGetLibraryNovelsFromDb.mockResolvedValue([]);
    mockGetLibraryNovelKeysFromDb.mockResolvedValue([]);
    mockGetCategoriesFromDb.mockResolvedValue([]);
    mockGetNovelByPath.mockReturnValue(undefined);
    mockSwitchNovelToLibraryQuery.mockResolvedValue({
      id: 1,
      inLibrary: true,
    } as NovelInfo);
  });

  it('updates the library when the reactive Novel query changes', () => {
    const liveQueries = captureLiveQueries();

    const { result } = renderHook(useLibrary);
    const updatedNovel = {
      id: 1,
      name: 'Updated novel',
      path: '/updated-novel',
      pluginId: 'test-plugin',
      chaptersDownloaded: 0,
    } as NovelInfo;

    act(() => liveQueries.library([updatedNovel]));

    expect(mockGetLibraryNovelsQuery).toHaveBeenCalledWith(
      'name ASC',
      {},
      '',
      false,
    );
    expect(result.current.library).toEqual([updatedNovel]);
  });

  it('passes the saved filters to the query and narrows the library by genre', () => {
    const filters = { downloaded: 'include', completed: 'exclude' } as const;
    mockUseLibrarySettings.mockReturnValue({
      filters,
      includedGenres: ['horror'],
      excludedGenres: ['harem'],
      sortOrder: 'name ASC',
      downloadedOnlyMode: false,
    } as unknown as ReturnType<typeof useLibrarySettings>);
    const liveQueries = captureLiveQueries();

    const { result } = renderHook(useLibrary);
    const novel = (id: number, genres: string | null) =>
      ({ id, name: `Novel ${id}`, genres } as NovelInfo);

    act(() =>
      liveQueries.library([
        novel(1, 'Horror, Mystery'),
        novel(2, ' horror ,Harem'),
        novel(3, 'Psychological Horror'),
        novel(4, null),
      ]),
    );

    expect(mockGetLibraryNovelsQuery).toHaveBeenCalledWith(
      'name ASC',
      filters,
      '',
      false,
    );
    expect(result.current.library.map(n => n.id)).toEqual([1]);
  });

  it('keeps saved novels hidden by filters reading as in the library', async () => {
    mockUseLibrarySettings.mockReturnValue({
      filters: { completed: 'exclude' },
      excludedGenres: ['harem'],
      sortOrder: 'name ASC',
      downloadedOnlyMode: false,
    } as unknown as ReturnType<typeof useLibrarySettings>);
    const genreHidden = {
      id: 1,
      pluginId: 'test-plugin',
      path: '/genre-hidden',
      genres: 'Harem',
    } as NovelInfo;
    const statusHidden = { pluginId: 'test-plugin', path: '/status-hidden' };
    const saved = [genreHidden, statusHidden];
    const liveQueries = captureLiveQueries();
    mockGetLibraryNovelsFromDb.mockResolvedValue([genreHidden] as Awaited<
      ReturnType<typeof getLibraryNovelsFromDb>
    >);
    mockGetLibraryNovelKeysFromDb.mockResolvedValue(
      saved as Awaited<ReturnType<typeof getLibraryNovelKeysFromDb>>,
    );
    const { result } = renderHook(useLibrary);
    const inLibrary = () =>
      saved.map(n => result.current.novelInLibrary(n.pluginId, n.path));

    act(() => {
      liveQueries.library([genreHidden]);
      liveQueries.keys(saved);
    });

    expect(result.current.library).toEqual([]);
    expect(inLibrary()).toEqual([true, true]);

    act(() => liveQueries.keys([]));
    expect(inLibrary()).toEqual([false, false]);

    await act(() => result.current.refetchLibrary());

    expect(result.current.library).toEqual([]);
    expect(inLibrary()).toEqual([true, true]);
    expect(result.current.novelInLibrary('other-plugin', '/genre-hidden')).toBe(
      false,
    );
  });

  it('stops loading and exposes database errors', async () => {
    const databaseError = new Error('Failed to load categories');
    mockGetCategoriesFromDb.mockRejectedValueOnce(databaseError);
    mockUseFocusEffect.mockImplementationOnce(callback => {
      callback();
    });

    const { result } = renderHook(useLibrary);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(databaseError);
  });

  it('keeps the focus callback stable across renders', () => {
    const { rerender } = renderHook(useLibrary);
    const firstFocusCallback = mockUseFocusEffect.mock.calls.at(-1)?.[0];

    rerender(undefined);

    expect(mockUseFocusEffect.mock.calls.at(-1)?.[0]).toBe(firstFocusCallback);
  });

  it('waits for category selection before adding a novel', async () => {
    mockUseLibrarySettings.mockReturnValue({
      filters: {},
      sortOrder: 'name ASC',
      downloadedOnlyMode: false,
      defaultCategoryId: 3,
      promptForCategoryOnAdd: true,
    } as ReturnType<typeof useLibrarySettings>);
    const { result } = renderHook(useLibrary);

    let completion: Promise<boolean> | undefined;
    await act(async () => {
      completion = result.current.switchNovelToLibrary(
        '/test/novel',
        'test-plugin',
      );
    });

    expect(result.current.pendingLibraryAddition).toEqual({
      initialCategoryIds: [],
    });
    expect(mockSwitchNovelToLibraryQuery).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmPendingLibraryAddition([4, 5]);
    });

    await expect(completion).resolves.toBe(true);
    expect(mockSwitchNovelToLibraryQuery).toHaveBeenCalledWith(
      '/test/novel',
      'test-plugin',
      [4, 5],
    );
    expect(result.current.pendingLibraryAddition).toBeUndefined();
  });

  it('only confirms a pending library addition once', async () => {
    mockUseLibrarySettings.mockReturnValue({
      filters: {},
      sortOrder: 'name ASC',
      downloadedOnlyMode: false,
      promptForCategoryOnAdd: true,
    } as ReturnType<typeof useLibrarySettings>);
    const { result } = renderHook(useLibrary);

    let completion: Promise<boolean> | undefined;
    await act(async () => {
      completion = result.current.switchNovelToLibrary(
        '/test/novel',
        'test-plugin',
      );
    });

    await act(async () => {
      const firstConfirmation = result.current.confirmPendingLibraryAddition([
        4,
      ]);
      const repeatedConfirmation = result.current.confirmPendingLibraryAddition(
        [4],
      );
      await Promise.all([firstConfirmation, repeatedConfirmation]);
    });

    await expect(completion).resolves.toBe(true);
    expect(mockSwitchNovelToLibraryQuery).toHaveBeenCalledTimes(1);
  });

  it('does not add a novel when category selection is cancelled', async () => {
    mockUseLibrarySettings.mockReturnValue({
      filters: {},
      sortOrder: 'name ASC',
      downloadedOnlyMode: false,
      promptForCategoryOnAdd: true,
    } as ReturnType<typeof useLibrarySettings>);
    const { result } = renderHook(useLibrary);

    let completion: Promise<boolean> | undefined;
    await act(async () => {
      completion = result.current.switchNovelToLibrary(
        '/test/novel',
        'test-plugin',
      );
    });
    act(result.current.cancelPendingLibraryAddition);

    await expect(completion).resolves.toBe(false);
    expect(mockSwitchNovelToLibraryQuery).not.toHaveBeenCalled();
  });
});
