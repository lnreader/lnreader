import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
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
    filter: undefined,
    sortOrder: 'name ASC',
    downloadedOnlyMode: false,
  })),
}));

jest.mock('@database/queries/LibraryQueries', () => ({
  getLibraryNovelsFromDb: jest.fn().mockResolvedValue([]),
  getLibraryNovelsQuery: jest.fn(() => ({ query: 'library' })),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  getCategoriesFromDb: jest.fn().mockResolvedValue([]),
  getCategoriesQuery: jest.fn(() => ({ query: 'categories' })),
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

const liveQueryCall = (table: string) => {
  const call = mockUseLiveQuery.mock.calls.find(
    ([, fireOn]) => fireOn[0].table === table,
  );
  if (!call) {
    throw new Error(`No live query on ${table}`);
  }
  return call as unknown as [
    unknown,
    { table: string }[],
    (rows: unknown[]) => void,
  ];
};
const categoriesLiveQuery = () => liveQueryCall('Category');
const libraryLiveQuery = () => liveQueryCall('Novel');

describe('useLibrary', () => {
  beforeEach(() => {
    mockUseLiveQuery.mockReturnValue([]);
    mockUseLiveQuery.mockClear();
    mockGetNovelByPath.mockClear();
    mockSwitchNovelToLibraryQuery.mockClear();
    mockUseLibrarySettings.mockReturnValue({
      filter: undefined,
      sortOrder: 'name ASC',
      downloadedOnlyMode: false,
    } as ReturnType<typeof useLibrarySettings>);
    mockGetLibraryNovelsFromDb.mockResolvedValue([]);
    mockGetCategoriesFromDb.mockResolvedValue([]);
    mockGetNovelByPath.mockReturnValue(undefined);
    mockSwitchNovelToLibraryQuery.mockResolvedValue({
      id: 1,
      inLibrary: true,
    } as NovelInfo);
  });

  it('updates the categories when the reactive category tables change', () => {
    const { result } = renderHook(useLibrary);
    const [, fireOn, onCategoriesChange] = categoriesLiveQuery();
    expect(fireOn).toEqual([{ table: 'Category' }, { table: 'NovelCategory' }]);

    act(() =>
      onCategoriesChange([
        { id: 1, name: 'Default', sort: 1, novelIds: null },
        { id: 2, name: 'Local', sort: 2, novelIds: null },
        { id: 3, name: 'Reading', sort: 3, novelIds: '7,9' },
      ]),
    );

    expect(result.current.categories.map(category => category.id)).toEqual([
      2, 3,
    ]);
    expect(result.current.categories[1].novelIds).toEqual([7, 9]);
  });

  it('ignores a manual category refresh that a live update overtook', async () => {
    let resolveRefresh: (rows: never[]) => void = () => undefined;
    mockGetCategoriesFromDb.mockReturnValueOnce(
      new Promise(resolve => {
        resolveRefresh = resolve;
      }),
    );
    const { result } = renderHook(useLibrary);
    const [, , onCategoriesChange] = categoriesLiveQuery();

    let refresh: Promise<void> = Promise.resolve();
    act(() => {
      refresh = result.current.refreshCategories();
    });
    act(() =>
      onCategoriesChange([
        { id: 3, name: 'Reading', sort: 1, novelIds: '7' },
        { id: 4, name: 'Later', sort: 2, novelIds: null },
      ]),
    );
    await act(async () => {
      resolveRefresh([]);
      await refresh;
    });

    expect(result.current.categories.map(category => category.id)).toEqual([
      3, 4,
    ]);
  });

  it('applies a manual category refresh when no live update overtook it', async () => {
    mockGetCategoriesFromDb.mockResolvedValueOnce([
      { id: 3, name: 'Reading', sort: 1, novelIds: '7' },
    ] as Awaited<ReturnType<typeof getCategoriesFromDb>>);
    const { result } = renderHook(useLibrary);

    await act(async () => {
      await result.current.refreshCategories();
    });

    expect(result.current.categories.map(category => category.id)).toEqual([3]);
  });

  it('keeps the default category when it holds novels', () => {
    const { result } = renderHook(useLibrary);
    const [, , onCategoriesChange] = categoriesLiveQuery();

    act(() =>
      onCategoriesChange([
        { id: 1, name: 'Default', sort: 1, novelIds: '4' },
        { id: 3, name: 'Reading', sort: 2, novelIds: '7' },
      ]),
    );

    expect(result.current.categories.map(category => category.id)).toEqual([
      1, 3,
    ]);
  });

  it('updates the library when the reactive Novel query changes', () => {
    const { result } = renderHook(useLibrary);
    const [, libraryFireOn, onLibraryChange] = libraryLiveQuery();
    expect(libraryFireOn).toEqual([{ table: 'Novel' }]);
    const updatedNovel = {
      id: 1,
      name: 'Updated novel',
      path: '/updated-novel',
      pluginId: 'test-plugin',
      chaptersDownloaded: 0,
    } as NovelInfo;

    act(() => onLibraryChange([updatedNovel]));

    expect(mockGetLibraryNovelsQuery).toHaveBeenCalledWith(
      'name ASC',
      undefined,
      '',
      false,
    );
    expect(result.current.library).toEqual([updatedNovel]);
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
      filter: undefined,
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
      filter: undefined,
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
      filter: undefined,
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
