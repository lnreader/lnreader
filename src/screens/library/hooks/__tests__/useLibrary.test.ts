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

describe('useLibrary', () => {
  beforeEach(() => {
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

  it('updates the library when the reactive Novel query changes', () => {
    let onLibraryChange: ((novels: NovelInfo[]) => void) | undefined;
    mockUseLiveQuery.mockImplementation((_query, fireOn, callback) => {
      expect(fireOn).toEqual([{ table: 'Novel' }]);
      onLibraryChange = callback as (novels: NovelInfo[]) => void;
      return [];
    });

    const { result } = renderHook(useLibrary);
    const updatedNovel = {
      id: 1,
      name: 'Updated novel',
      path: '/updated-novel',
      pluginId: 'test-plugin',
      chaptersDownloaded: 0,
    } as NovelInfo;

    act(() => onLibraryChange?.([updatedNovel]));

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
