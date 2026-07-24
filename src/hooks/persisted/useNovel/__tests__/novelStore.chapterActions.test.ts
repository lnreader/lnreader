import '../../../__tests__/mocks';
import { ChapterInfo, NovelInfo } from '@database/types';
import { ChapterRow } from '@database/schema';
import { createBootstrapService } from '../store-helper/bootstrapService';
import {
  bookmarkChaptersAction,
  ChapterActionsDependencies,
  deleteChapterAction,
  deleteChaptersAction,
  increaseTimeSpentAction,
  markChapterReadAction,
  markChaptersReadAction,
  markChaptersUnreadAction,
  markPreviouschaptersReadAction,
  markPreviousChaptersUnreadAction,
  updateChapterProgressAction,
} from '../store/chapterActions';
import { createNovelStoreChapterActions } from '../store/novelStore.chapterActions';
import { BatchInfo, NovelSettingsWithoutSort } from '../types';

jest.mock('../store/chapterActions', () => {
  const actual = jest.requireActual('../store/chapterActions');
  return {
    ...actual,
    bookmarkChaptersAction: jest.fn(),
    deleteChapterAction: jest.fn(),
    deleteChaptersAction: jest.fn(),
    markChapterReadAction: jest.fn(),
    markChaptersReadAction: jest.fn(),
    markChaptersUnreadAction: jest.fn(),
    markChaptersUnreadAndResetProgressAction: jest.fn(),
    markPreviouschaptersReadAction: jest.fn(),
    markPreviousChaptersUnreadAction: jest.fn(),
    updateChapterProgressAction: jest.fn(),
    increaseTimeSpentAction: jest.fn(),
  };
});

type BootstrapServiceSlice = Pick<
  ReturnType<typeof createBootstrapService>,
  'getNextChapterBatch' | 'loadUpToBatch'
>;

interface TestState {
  novel: NovelInfo | undefined;
  pages: string[];
  pageIndex: number;
  chapters: ChapterInfo[];
  chapterTextCache: Record<number, string | Promise<string>>;
  fetching: boolean;
  novelSettings: NovelSettingsWithoutSort;
  batchInformation: BatchInfo;
  actions: {
    getChapters: jest.Mock<Promise<void>, []>;
  };
}

const makeChapter = (
  id: number,
  overrides: Partial<ChapterRow> = {},
): ChapterRow => ({
  id,
  novelId: 1,
  path: `/chapter/${id}`,
  name: `Chapter ${id}`,
  releaseTime: '2024-01-01',
  readTime: null,
  bookmark: false,
  unread: true,
  isDownloaded: true,
  updatedTime: '2024-01-01',
  chapterNumber: id,
  page: '1',
  progress: 0,
  position: id - 1,
  timeSpent: 0,
  ...overrides,
  scanlator: overrides.scanlator ?? null,
});

const mockNovel: NovelInfo = {
  id: 1,
  path: '/novels/test',
  pluginId: 'plugin.test',
  name: 'Test Novel',
};

const createDeps = (): jest.Mocked<ChapterActionsDependencies> => ({
  bookmarkChapter: jest.fn().mockResolvedValue(undefined),
  markChapterRead: jest.fn().mockResolvedValue(undefined),
  markChaptersRead: jest.fn().mockResolvedValue(undefined),
  markPreviuschaptersRead: jest.fn().mockResolvedValue(undefined),
  markPreviousChaptersUnread: jest.fn().mockResolvedValue(undefined),
  markChaptersUnread: jest.fn().mockResolvedValue(undefined),
  updateChapterProgress: jest.fn().mockResolvedValue(undefined),
  updateChapterProgressByIds: jest.fn().mockResolvedValue(undefined),
  deleteChapter: jest.fn().mockResolvedValue(undefined),
  deleteChapters: jest.fn().mockResolvedValue(undefined),
  getPageChapters: jest.fn().mockResolvedValue([]),
  increaseTimeSpent: jest.fn().mockResolvedValue(undefined),
  showToast: jest.fn(),
  getString: jest
    .fn<
      ReturnType<ChapterActionsDependencies['getString']>,
      Parameters<ChapterActionsDependencies['getString']>
    >()
    .mockImplementation(stringKey => String(stringKey)),
});

const createHarness = (overrides: Partial<TestState> = {}) => {
  let state: TestState = {
    novel: mockNovel,
    pages: ['1', '2'],
    pageIndex: 0,
    chapters: [makeChapter(1)],
    chapterTextCache: {},
    fetching: false,
    novelSettings: { filter: [], showChapterTitles: true },
    batchInformation: { batch: 0, total: 4 },
    actions: {
      getChapters: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };

  const set = jest.fn(
    (partial: Partial<TestState> | ((s: TestState) => Partial<TestState>)) => {
      const patch = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...patch };
    },
  );
  const get = () => state;
  const bootstrapService: jest.Mocked<BootstrapServiceSlice> = {
    getNextChapterBatch: jest.fn(),
    loadUpToBatch: jest.fn(),
  };
  const chapterDeps = createDeps();
  const transformChapters = jest.fn((chs: ChapterInfo[]) =>
    chs.map(ch => ({ ...ch, name: `[tx] ${ch.name}` })),
  );
  let requestVersion = 0;
  const chapterRequestCoordinator = {
    current: jest.fn(() => requestVersion),
    invalidate: jest.fn(() => ++requestVersion),
  };

  const actions = createNovelStoreChapterActions({
    //@ts-expect-error partial state/actions for testing
    set, //@ts-expect-error
    get,
    bootstrapService,
    chapterActionsDependencies: chapterDeps,
    chapterRequestCoordinator,
    transformChapters,
    defaultChapterSort: 'positionAsc',
  });

  return {
    actions,
    getState: () => state,
    set,
    bootstrapService,
    chapterDeps,
    chapterRequestCoordinator,
    transformChapters,
  };
};

describe('novelStore.chapterActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getNextChapterBatch appends transformed chapters and advances batch', async () => {
    const harness = createHarness();
    harness.bootstrapService.getNextChapterBatch.mockResolvedValue({
      batch: 1,
      chapters: [makeChapter(2), makeChapter(3)],
    });

    await harness.actions.getNextChapterBatch();

    expect(harness.bootstrapService.getNextChapterBatch).toHaveBeenCalledWith({
      novel: mockNovel,
      pages: ['1', '2'],
      pageIndex: 0,
      settingsSort: 'positionAsc',
      settingsFilter: [],
      batchInformation: { batch: 0, total: 4 },
    });
    expect(harness.getState().batchInformation.batch).toBe(1);
    expect(harness.getState().chapters.map(ch => ch.id)).toEqual([1, 2, 3]);
    expect(harness.getState().chapters[1].name).toBe('[tx] Chapter 2');
  });

  it('getNextChapterBatch dedupes concurrent calls', async () => {
    const harness = createHarness();
    harness.bootstrapService.getNextChapterBatch.mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(
            () =>
              resolve({
                batch: 1,
                chapters: [makeChapter(2)],
              }),
            1,
          );
        }),
    );

    await Promise.all([
      harness.actions.getNextChapterBatch(),
      harness.actions.getNextChapterBatch(),
    ]);

    expect(harness.bootstrapService.getNextChapterBatch).toHaveBeenCalledTimes(
      1,
    );
    expect(harness.getState().batchInformation.batch).toBe(1);
    expect(harness.getState().chapters.map(ch => ch.id)).toEqual([1, 2]);
  });

  it('getNextChapterBatch guard keeps state stable when bootstrap returns no result', async () => {
    const harness = createHarness();
    const before = harness.getState();
    harness.bootstrapService.getNextChapterBatch.mockResolvedValue(undefined);

    await harness.actions.getNextChapterBatch();

    expect(harness.getState()).toEqual(before);
    expect(harness.set).not.toHaveBeenCalled();
  });

  it('ignores a next-batch result invalidated by a page or filter load', async () => {
    const harness = createHarness();
    let resolveBatch!: (value: {
      batch: number;
      chapters: ChapterRow[];
    }) => void;
    harness.bootstrapService.getNextChapterBatch.mockReturnValue(
      new Promise(resolve => {
        resolveBatch = resolve;
      }),
    );

    const request = harness.actions.getNextChapterBatch();
    harness.chapterRequestCoordinator.invalidate();
    resolveBatch({ batch: 1, chapters: [makeChapter(2)] });
    await request;

    expect(harness.getState().batchInformation.batch).toBe(0);
    expect(harness.getState().chapters.map(chapter => chapter.id)).toEqual([1]);
  });

  it('loadUpToBatch merges each loaded batch through onBatchLoaded callback', async () => {
    const harness = createHarness();
    harness.bootstrapService.loadUpToBatch.mockImplementation(async params => {
      params.onBatchLoaded(1, [makeChapter(2)]);
      params.onBatchLoaded(2, [makeChapter(3)]);
    });

    await harness.actions.loadUpToBatch(2);

    expect(harness.bootstrapService.loadUpToBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        targetBatch: 2,
        novel: mockNovel,
        settingsSort: 'positionAsc',
        settingsFilter: [],
      }),
    );
    expect(harness.getState().batchInformation.batch).toBe(2);
    expect(harness.getState().chapters.map(ch => ch.id)).toEqual([1, 2, 3]);
  });

  it('loadUpToBatch coalesces overlapping in-flight targets', async () => {
    const harness = createHarness();
    harness.bootstrapService.loadUpToBatch.mockImplementation(async params => {
      if (params.targetBatch === 2) {
        params.onBatchLoaded(1, [makeChapter(2)]);
        params.onBatchLoaded(2, [makeChapter(3)]);
        await Promise.resolve();
        return;
      }

      if (params.targetBatch === 4) {
        params.onBatchLoaded(3, [makeChapter(4)]);
        params.onBatchLoaded(4, [makeChapter(5)]);
      }
    });

    const first = harness.actions.loadUpToBatch(2);
    const second = harness.actions.loadUpToBatch(4);
    await Promise.all([first, second]);

    expect(harness.bootstrapService.loadUpToBatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        targetBatch: 2,
      }),
    );
    expect(harness.bootstrapService.loadUpToBatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        targetBatch: 4,
      }),
    );
    expect(harness.getState().batchInformation.batch).toBe(4);
    expect(harness.getState().chapters.map(ch => ch.id)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('ignores loaded batches after the request generation changes', async () => {
    const harness = createHarness();
    let resolveLoad!: () => void;
    harness.bootstrapService.loadUpToBatch.mockImplementation(
      params =>
        new Promise<void>(resolve => {
          resolveLoad = () => {
            params.onBatchLoaded(1, [makeChapter(2)]);
            resolve();
          };
        }),
    );

    const request = harness.actions.loadUpToBatch(1);
    harness.chapterRequestCoordinator.invalidate();
    resolveLoad();
    await request;

    expect(harness.getState().batchInformation.batch).toBe(0);
    expect(harness.getState().chapters.map(chapter => chapter.id)).toEqual([1]);
  });

  it('chapterTextCache supports read/write/remove/clear through state-backed cache', () => {
    const harness = createHarness();
    const pendingText = Promise.resolve('chapter text');

    expect(harness.actions.chapterTextCache.read(1)).toBeUndefined();

    harness.actions.chapterTextCache.write(1, pendingText);
    expect(harness.actions.chapterTextCache.read(1)).toBe(pendingText);
    expect(harness.getState().chapterTextCache[1]).toBe(pendingText);

    harness.actions.chapterTextCache.remove(1);
    expect(harness.actions.chapterTextCache.read(1)).toBeUndefined();

    harness.actions.chapterTextCache.write(2, 'second');
    harness.actions.chapterTextCache.clear();
    expect(harness.getState().chapterTextCache).toEqual({});
  });

  it('updateChapter guard does nothing when novel is missing', () => {
    const harness = createHarness({ novel: undefined });

    harness.actions.updateChapter(0, { progress: 87 });

    expect(harness.getState().chapters[0].progress).toBe(0);
    expect(harness.set).not.toHaveBeenCalled();
  });

  it('bookmarkChapters delegates to chapterActions and mutate guard blocks writes without novel', () => {
    const harness = createHarness({ novel: undefined });
    (
      bookmarkChaptersAction as jest.MockedFunction<
        typeof bookmarkChaptersAction
      >
    ).mockImplementation((_chapters, mutate) => {
      mutate(chs => chs.map(ch => ({ ...ch, bookmark: true })));
    });

    harness.actions.bookmarkChapters([makeChapter(1)]);

    expect(bookmarkChaptersAction).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1 })],
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(harness.getState().chapters[0].bookmark).toBe(false);
    expect(harness.set).not.toHaveBeenCalled();
  });

  it('markChapterRead delegates mutation to low-level action with dependencies', () => {
    const harness = createHarness();
    (
      markChapterReadAction as jest.MockedFunction<typeof markChapterReadAction>
    ).mockImplementation((chapterId, mutate) => {
      mutate(chs =>
        chs.map(ch => (ch.id === chapterId ? { ...ch, unread: false } : ch)),
      );
    });

    harness.actions.markChapterRead(1);

    expect(markChapterReadAction).toHaveBeenCalledWith(
      1,
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(harness.getState().chapters[0].unread).toBe(false);
  });

  it('refreshChapters delegates to the guarded store loader', () => {
    const harness = createHarness({ pages: [], pageIndex: 3, fetching: true });

    harness.actions.refreshChapters();

    expect(harness.getState().actions.getChapters).toHaveBeenCalledTimes(1);
  });

  it('delegates remaining chapter action entry points to low-level helpers', () => {
    const harness = createHarness();

    harness.actions.markPreviouschaptersRead(3);
    harness.actions.markChaptersRead([makeChapter(1)]);
    harness.actions.markPreviousChaptersUnread(3);
    harness.actions.markChaptersUnread([makeChapter(1)]);
    harness.actions.updateChapterProgress(1, 50);
    harness.actions.deleteChapter(makeChapter(1));
    harness.actions.deleteChapters([makeChapter(1)]);

    expect(markPreviouschaptersReadAction).toHaveBeenCalledWith(
      3,
      mockNovel,
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(markChaptersReadAction).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1 })],
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(markPreviousChaptersUnreadAction).toHaveBeenCalledWith(
      3,
      mockNovel,
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(markChaptersUnreadAction).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1 })],
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(updateChapterProgressAction).toHaveBeenCalledWith(
      1,
      50,
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(deleteChapterAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      mockNovel,
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(deleteChaptersAction).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1 })],
      mockNovel,
      expect.any(Function),
      harness.chapterDeps,
    );
  });
  it('increaseTimeSpent delegates mutation to low-level action with dependencies', () => {
    const harness = createHarness();
    (
      increaseTimeSpentAction as jest.MockedFunction<
        typeof increaseTimeSpentAction
      >
    ).mockImplementation((chapterId, timeSpent, mutate) => {
      mutate(chs =>
        chs.map(ch =>
          ch.id === chapterId
            ? { ...ch, timeSpent: (ch.timeSpent ?? 0) + timeSpent }
            : ch,
        ),
      );
    });

    harness.actions.increaseTimeSpent(1, 200);

    expect(increaseTimeSpentAction).toHaveBeenCalledWith(
      1,
      200,
      expect.any(Function),
      harness.chapterDeps,
    );
    expect(harness.getState().chapters[0].timeSpent).toBe(200);
  });
});
