import { act, renderHook, waitFor } from '@testing-library/react-native';
import useChapter from '../useChapter';
import NativeFile from '@specs/NativeFile';

const mockUseNovelActions = jest.fn();
const mockUseChapterGeneralSettings = jest.fn();
const mockUseLibrarySettings = jest.fn();
const mockUseTracker = jest.fn();
const mockUseTrackedNovel = jest.fn();
const mockUseFullscreenMode = jest.fn();

const mockGetDbChapter = jest.fn();
const mockGetChapterCount = jest.fn();
const mockGetNextChapter = jest.fn();
const mockGetPrevChapter = jest.fn();
const mockInsertChapters = jest.fn();
const mockInsertHistory = jest.fn();
const mockFetchChapter = jest.fn();
const mockFetchPage = jest.fn();
const mockSanitizeChapterText = jest.fn();
const mockParseChapterNumber = jest.fn();

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelActions: () => mockUseNovelActions(),
}));

jest.mock('@hooks/persisted', () => ({
  useChapterGeneralSettings: () => mockUseChapterGeneralSettings(),
  useLibrarySettings: () => mockUseLibrarySettings(),
  useTracker: () => mockUseTracker(),
  useTrackedNovel: (...args: unknown[]) => mockUseTrackedNovel(...args),
}));

jest.mock('@hooks', () => ({
  useFullscreenMode: () => mockUseFullscreenMode(),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: (...args: unknown[]) => mockGetDbChapter(...args),
  getChapterCount: (...args: unknown[]) => mockGetChapterCount(...args),
  getNextChapter: (...args: unknown[]) => mockGetNextChapter(...args),
  getPrevChapter: (...args: unknown[]) => mockGetPrevChapter(...args),
  insertChapters: (...args: unknown[]) => mockInsertChapters(...args),
}));

jest.mock('@database/queries/HistoryQueries', () => ({
  insertHistory: (...args: unknown[]) => mockInsertHistory(...args),
}));

jest.mock('@services/plugin/fetch', () => ({
  fetchChapter: (...args: unknown[]) => mockFetchChapter(...args),
  fetchPage: (...args: unknown[]) => mockFetchPage(...args),
}));

jest.mock('../../utils/sanitizeChapterText', () => ({
  sanitizeChapterText: (...args: unknown[]) => mockSanitizeChapterText(...args),
}));

jest.mock('@utils/parseChapterNumber', () => ({
  parseChapterNumber: (...args: unknown[]) => mockParseChapterNumber(...args),
}));

jest.mock('expo-speech', () => ({
  stop: jest.fn(),
}));

const makeChapter = (id: number, page = '1') => ({
  id,
  novelId: 7,
  name: `Chapter ${id}`,
  path: `/chapter/${id}`,
  page,
  position: id,
  unread: true,
  isDownloaded: false,
  bookmark: false,
  progress: 0,
  releaseTime: '2026-01-01',
  updatedTime: '2026-01-01',
  readTime: '2026-01-01',
});

const makeNovel = () => ({
  id: 7,
  pluginId: 'plugin.reader',
  path: '/novel/test',
  name: 'Novel Test',
  totalPages: 3,
  inLibrary: true,
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const createStore = (
  cacheSeed: Record<number, string | Promise<string>> = {},
) => {
  const cache = new Map<number, string | Promise<string>>(
    Object.entries(cacheSeed).map(([k, v]) => [Number(k), v]),
  );
  const chapterTextCache = {
    read: jest.fn((chapterId: number) => cache.get(chapterId)),
    write: jest.fn((chapterId: number, value: string | Promise<string>) => {
      cache.set(chapterId, value);
    }),
    remove: jest.fn((chapterId: number) => {
      cache.delete(chapterId);
    }),
    clear: jest.fn(() => cache.clear()),
  };
  const state = {
    markChapterRead: jest.fn(),
    updateChapterProgress: jest.fn(),
    chapterTextCache,
    setLastRead: jest.fn(),
  };

  return {
    getState: () => state,
    subscribe: jest.fn(() => () => {}),
    state,
    chapterTextCache,
  };
};

describe('useChapter', () => {
  const initialChapter = makeChapter(1, '1');
  const nextChapter = makeChapter(2, '1');
  const novel = makeNovel();

  beforeEach(() => {
    jest.clearAllMocks();
    (NativeFile.exists as jest.Mock).mockReturnValue(false);
    (NativeFile.readFile as jest.Mock).mockReturnValue('');

    mockUseChapterGeneralSettings.mockReturnValue({
      autoScroll: false,
      autoScrollInterval: 1,
      autoScrollOffset: 100,
      useVolumeButtons: false,
      volumeButtonsOffset: 100,
    });
    mockUseLibrarySettings.mockReturnValue({ incognitoMode: false });
    mockUseTracker.mockReturnValue({ tracker: { id: 'tracker' } });
    mockUseTrackedNovel.mockReturnValue({
      trackedNovel: { progress: 1 },
      updateAllTrackedNovels: jest.fn(),
    });
    mockUseFullscreenMode.mockReturnValue({
      setImmersiveMode: jest.fn(),
      showStatusAndNavBar: jest.fn(),
    });

    mockGetDbChapter.mockResolvedValue(initialChapter);
    mockGetChapterCount.mockResolvedValue(1);
    mockGetNextChapter.mockResolvedValue(undefined);
    mockGetPrevChapter.mockResolvedValue(undefined);
    mockInsertChapters.mockResolvedValue(undefined);
    mockInsertHistory.mockResolvedValue(undefined);
    mockFetchChapter.mockResolvedValue('chapter body');
    mockFetchPage.mockResolvedValue({ chapters: [] });
    mockSanitizeChapterText.mockImplementation(
      (
        _pluginId: string,
        _novelName: string,
        _chapterName: string,
        text: string,
      ) => `SANITIZED:${text}`,
    );
    mockParseChapterNumber.mockReturnValue(5);
  });

  it('uses chapterTextCache on initial load and avoids duplicate fetch for cached chapter text', async () => {
    const store = createStore({ [initialChapter.id]: 'cached chapter body' });
    mockUseNovelActions.mockReturnValue(store.state);

    const { result } = renderHook(() =>
      useChapter({ current: null }, initialChapter, novel),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetchChapter).not.toHaveBeenCalled();
    expect(result.current.chapterText).toBe('SANITIZED:cached chapter body');
    expect(store.chapterTextCache.write).not.toHaveBeenCalledWith(
      initialChapter.id,
      expect.anything(),
    );
  });

  it('hydrates the initial chapter from the database before rendering reader progress', async () => {
    const store = createStore({ [initialChapter.id]: 'cached chapter body' });
    const hydratedChapter = { ...initialChapter, progress: 56 };
    mockUseNovelActions.mockReturnValue(store.state);
    mockGetDbChapter.mockResolvedValue(hydratedChapter);

    const { result } = renderHook(() =>
      useChapter({ current: null }, initialChapter, novel),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.chapter.progress).toBe(56);
  });

  it('uses database progress as the source of truth on initial open', async () => {
    const routeChapter = { ...initialChapter, progress: 72 };
    const dbChapter = { ...initialChapter, progress: 12 };
    const store = createStore({ [initialChapter.id]: 'cached chapter body' });
    mockUseNovelActions.mockReturnValue(store.state);
    mockGetDbChapter.mockResolvedValue(dbChapter);

    const { result } = renderHook(() =>
      useChapter({ current: null }, routeChapter, novel),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.chapter.progress).toBe(12);
  });

  it('updates chapter progress, caps at 100, and marks chapter read/tracker progress near completion', async () => {
    const store = createStore();
    const updateAllTrackedNovels = jest.fn();
    mockUseTrackedNovel.mockReturnValue({
      trackedNovel: { progress: 2 },
      updateAllTrackedNovels,
    });
    mockUseNovelActions.mockReturnValue(store.state);

    const { result } = renderHook(() =>
      useChapter({ current: null }, initialChapter, novel),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.saveProgress(40);
      result.current.saveProgress(130);
    });

    expect(store.state.updateChapterProgress).toHaveBeenNthCalledWith(
      1,
      initialChapter.id,
      40,
    );
    expect(store.state.updateChapterProgress).toHaveBeenNthCalledWith(
      2,
      initialChapter.id,
      100,
    );
    expect(store.state.markChapterRead).toHaveBeenCalledTimes(1);
    expect(store.state.markChapterRead).toHaveBeenCalledWith(initialChapter.id);
    expect(mockParseChapterNumber).toHaveBeenCalledWith(
      novel.name,
      initialChapter.name,
    );
    expect(updateAllTrackedNovels).toHaveBeenCalledWith({ progress: 5 });
  });

  it('sets error and remains stable when chapter fetch fails', async () => {
    const store = createStore();
    mockUseNovelActions.mockReturnValue(store.state);
    mockFetchChapter.mockRejectedValueOnce(new Error('network failed'));

    const { result } = renderHook(() =>
      useChapter({ current: null }, initialChapter, novel),
    );

    await waitFor(() => expect(result.current.error).toBe('network failed'));
    expect(result.current.loading).toBe(false);
    expect(result.current.chapterText).toBe('SANITIZED:');
  });

  it('reuses prefetched promise cache to avoid duplicate concurrent fetches for same chapter', async () => {
    const store = createStore();
    mockUseNovelActions.mockReturnValue(store.state);

    const deferredNext = createDeferred<string>();

    mockGetNextChapter.mockImplementation(
      async (_novelId: number, position: number) =>
        position === initialChapter.position ? nextChapter : undefined,
    );
    mockFetchChapter.mockImplementation(
      async (_pluginId: string, path: string) => {
        if (path === nextChapter.path) {
          return deferredNext.promise;
        }

        return 'initial body';
      },
    );

    const { result } = renderHook(() =>
      useChapter({ current: null }, initialChapter, novel),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const navPromise = result.current.getChapter(nextChapter);

    expect(
      mockFetchChapter.mock.calls.filter(
        ([, path]) => path === nextChapter.path,
      ),
    ).toHaveLength(1);

    await act(async () => {
      deferredNext.resolve('next body');
      await navPromise;
    });

    expect(result.current.chapter.id).toBe(nextChapter.id);
    expect(result.current.chapterText).toBe('SANITIZED:next body');
  });
});
