import { act, renderHook, waitFor } from '@testing-library/react-native';
import useChapter from '../useChapter';
import NativeFile from '@modules/native-file';

const mockUseNovelActions = jest.fn();
const mockUseChapterGeneralSettings = jest.fn();
const mockUseLibrarySettings = jest.fn();
const mockUseAppSettings = jest.fn();
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

const mockUseNovelValue = jest.fn();

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelActions: () => mockUseNovelActions(),
  useNovelValue: (key: string) => mockUseNovelValue(key),
}));

jest.mock('@hooks/persisted', () => ({
  useChapterGeneralSettings: () => mockUseChapterGeneralSettings(),
  useLibrarySettings: () => mockUseLibrarySettings(),
  useAppSettings: () => mockUseAppSettings(),
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
  timeSpent: 0,
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

type WebViewRef = Parameters<typeof useChapter>[0];

/** A WebView stand-in that records the scripts the hook hands the page. */
const createWebViewRef = (injectJavaScript: jest.Mock) => {
  return { current: { injectJavaScript } } as unknown as WebViewRef;
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
    increaseTimeSpent: jest.fn(),
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

  /**
   * The hook keeps `hidden` separate from the rest so the reader chrome can
   * toggle without invalidating the chapter context; flattening both keeps the
   * assertions below focused on behaviour.
   */
  const useFlatChapter = (
    chapter: ReturnType<typeof makeChapter>,
    webViewRef: WebViewRef = { current: null },
  ) => {
    const { hidden, chapterContext } = useChapter(webViewRef, chapter, novel);

    return { hidden, ...chapterContext };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (NativeFile.exists as jest.Mock).mockReturnValue(false);
    // The native module rejects when the chapter is not downloaded.
    (NativeFile.readFile as jest.Mock).mockRejectedValue(
      new Error('File not found'),
    );

    mockUseChapterGeneralSettings.mockReturnValue({
      autoScroll: false,
      autoScrollInterval: 1,
      autoScrollOffset: 100,
      useVolumeButtons: false,
      volumeButtonsOffset: 100,
    });
    mockUseLibrarySettings.mockReturnValue({ incognitoMode: false });
    mockUseAppSettings.mockReturnValue({
      timeTrackingEnabled: true,
      inactivityTimeoutMs: 60000,
    });
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

    const { result } = renderHook(() => useFlatChapter(initialChapter));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetchChapter).not.toHaveBeenCalled();
    // Cached entries are already sanitized, so they are rendered as they are.
    expect(result.current.chapterText).toBe('cached chapter body');
    expect(mockSanitizeChapterText).not.toHaveBeenCalled();
    expect(store.chapterTextCache.write).not.toHaveBeenCalledWith(
      initialChapter.id,
      expect.anything(),
    );
  });

  it('renders a downloaded chapter from storage without touching the network', async () => {
    const store = createStore();
    mockUseNovelActions.mockReturnValue(store.state);
    (NativeFile.readFile as jest.Mock).mockResolvedValue('downloaded body');

    const { result } = renderHook(() => useFlatChapter(initialChapter));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.chapterText).toBe('SANITIZED:downloaded body');
    expect(mockFetchChapter).not.toHaveBeenCalled();
    // A single native call doubles as the existence check.
    expect(NativeFile.readFile).toHaveBeenCalledTimes(1);
    expect(NativeFile.exists).not.toHaveBeenCalled();
  });

  it('renders the chapter before its adjacent chapters are resolved', async () => {
    const store = createStore();
    mockUseNovelActions.mockReturnValue(store.state);
    (NativeFile.readFile as jest.Mock).mockResolvedValue('downloaded body');

    const deferredNextChapter = createDeferred<unknown>();
    mockGetNextChapter.mockReturnValue(deferredNextChapter.promise);

    const { result } = renderHook(() => useFlatChapter(initialChapter));

    // The neighbouring chapter lookups must not gate the first render.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.chapterText).toBe('SANITIZED:downloaded body');
    expect(result.current.nextChapter).toBeUndefined();

    await act(async () => {
      deferredNextChapter.resolve(nextChapter);
      await deferredNextChapter.promise;
    });

    await waitFor(() =>
      expect(result.current.nextChapter).toEqual(nextChapter),
    );
  });

  it('hydrates the initial chapter from the database before rendering reader progress', async () => {
    const store = createStore({ [initialChapter.id]: 'cached chapter body' });
    const hydratedChapter = { ...initialChapter, progress: 56 };
    mockUseNovelActions.mockReturnValue(store.state);
    mockGetDbChapter.mockResolvedValue(hydratedChapter);

    const { result } = renderHook(() => useFlatChapter(initialChapter));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.chapter.progress).toBe(56);
  });

  it('uses database progress as the source of truth on initial open', async () => {
    const routeChapter = { ...initialChapter, progress: 72 };
    const dbChapter = { ...initialChapter, progress: 12 };
    const store = createStore({ [initialChapter.id]: 'cached chapter body' });
    mockUseNovelActions.mockReturnValue(store.state);
    mockGetDbChapter.mockResolvedValue(dbChapter);

    const { result } = renderHook(() => useFlatChapter(routeChapter));

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

    const { result } = renderHook(() => useFlatChapter(initialChapter));

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

  it('sets error and drops the failed load from the cache so a retry refetches', async () => {
    const store = createStore();
    mockUseNovelActions.mockReturnValue(store.state);
    mockFetchChapter.mockRejectedValueOnce(new Error('network failed'));

    const { result } = renderHook(() => useFlatChapter(initialChapter));

    await waitFor(() => expect(result.current.error).toBe('network failed'));
    expect(result.current.loading).toBe(false);
    expect(result.current.chapterText).toBe('');
    expect(store.chapterTextCache.read(initialChapter.id)).toBeUndefined();

    mockFetchChapter.mockResolvedValue('recovered body');
    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() =>
      expect(result.current.chapterText).toBe('SANITIZED:recovered body'),
    );
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

    const { result } = renderHook(() => useFlatChapter(initialChapter));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The next chapter is prefetched once the current one is on screen.
    await waitFor(() =>
      expect(
        mockFetchChapter.mock.calls.filter(
          ([, path]) => path === nextChapter.path,
        ),
      ).toHaveLength(1),
    );

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

  describe('continuous reading', () => {
    const streamChapter = async () => {
      const injectJavaScript = jest.fn();
      const { result } = renderHook(() =>
        useFlatChapter(initialChapter, createWebViewRef(injectJavaScript)),
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.loadInlineChapter('NEXT');
      });

      const scripts = injectJavaScript.mock.calls.map(([script]) => script);
      return { result, scripts };
    };

    it('hands the following chapter to the open document', async () => {
      const store = createStore();
      mockUseNovelActions.mockReturnValue(store.state);
      mockGetNextChapter.mockImplementation(
        async (_novelId: number, position: number) =>
          position === initialChapter.position ? nextChapter : undefined,
      );

      const { result, scripts } = await streamChapter();

      const insert = scripts.find((script: string) =>
        script.includes('insertChapter'),
      );
      expect(insert).toContain('"direction":"NEXT"');
      expect(insert).toContain(`"id":${nextChapter.id}`);
      expect(insert).toContain('SANITIZED:chapter body');

      await act(async () => {
        result.current.setActiveChapter(nextChapter.id);
      });

      // The reader follows what is on screen, while the document it was built
      // from stays put - anything else would reload the WebView.
      expect(result.current.chapter.id).toBe(nextChapter.id);
      expect(result.current.documentChapter.id).toBe(initialChapter.id);
    });

    it('tells the document when the novel has run out', async () => {
      const store = createStore();
      mockUseNovelActions.mockReturnValue(store.state);

      const { scripts } = await streamChapter();

      expect(
        scripts.some((script: string) => script.includes('setEdgeReached')),
      ).toBe(true);
      expect(
        scripts.some((script: string) => script.includes('insertChapter')),
      ).toBe(false);
    });

    it('saves progress against the chapter it was reported for', async () => {
      const store = createStore();
      mockUseNovelActions.mockReturnValue(store.state);
      mockGetNextChapter.mockImplementation(
        async (_novelId: number, position: number) =>
          position === initialChapter.position ? nextChapter : undefined,
      );

      const { result } = await streamChapter();

      await act(async () => {
        result.current.setActiveChapter(nextChapter.id);
      });

      act(() => {
        result.current.saveProgress(100, initialChapter.id);
      });

      expect(store.state.updateChapterProgress).toHaveBeenCalledWith(
        initialChapter.id,
        100,
      );
      expect(store.state.markChapterRead).toHaveBeenCalledWith(
        initialChapter.id,
      );
    });
  });
});
