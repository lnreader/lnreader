import '../../../__tests__/mocks';
import { ChapterInfo, NovelInfo } from '@database/types';
import {
  bookmarkChaptersAction,
  ChapterActionsDependencies,
  deleteChapterAction,
  deleteChaptersAction,
  increaseTimeSpentAction,
  markChapterReadAction,
  markChaptersReadAction,
  markChaptersUnreadAction,
  markChaptersUnreadAndResetProgressAction,
  markPreviouschaptersReadAction,
  markPreviousChaptersUnreadAction,
  refreshChaptersAction,
  updateChapterProgressAction,
} from '../store/chapterActions';

const makeChapter = (id: number, overrides: Partial<ChapterInfo> = {}) => ({
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

const createStateMutator = (initial: ChapterInfo[]) => {
  let state = [...initial];
  const mutate = (mutation: (chs: ChapterInfo[]) => ChapterInfo[]) => {
    state = mutation(state);
  };

  return {
    mutate,
    getState: () => state,
  };
};

describe('chapterActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bookmarkChaptersAction toggles bookmark state and calls db mutation for each id', () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1), makeChapter(2)]);

    bookmarkChaptersAction([makeChapter(2)], state.mutate, deps);

    expect(deps.bookmarkChapter).toHaveBeenCalledWith(2);
    expect(state.getState().map(ch => ch.bookmark)).toEqual([false, true]);
  });

  it('markChapterReadAction marks target chapter read in db and state', () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1), makeChapter(2)]);

    markChapterReadAction(1, state.mutate, deps);

    expect(deps.markChapterRead).toHaveBeenCalledWith(1);
    expect(state.getState().map(ch => ch.unread)).toEqual([false, true]);
  });

  it('markChaptersReadAction supports empty selection and still keeps state stable', () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1), makeChapter(2)]);

    markChaptersReadAction([], state.mutate, deps);

    expect(deps.markChaptersRead).toHaveBeenCalledWith([]);
    expect(state.getState().map(ch => ch.unread)).toEqual([true, true]);
  });

  it('markPreviouschaptersReadAction is safe no-op when novel is absent', () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1), makeChapter(2)]);

    markPreviouschaptersReadAction(2, undefined, state.mutate, deps);

    expect(deps.markPreviuschaptersRead).not.toHaveBeenCalled();
    expect(state.getState().map(ch => ch.unread)).toEqual([true, true]);
  });

  it('markPreviousChaptersUnreadAction updates previous chapters and persists mutation', () => {
    const deps = createDeps();
    const state = createStateMutator([
      makeChapter(1, { unread: false }),
      makeChapter(2, { unread: false }),
      makeChapter(3, { unread: false }),
    ]);

    markPreviousChaptersUnreadAction(2, mockNovel, state.mutate, deps);

    expect(deps.markPreviousChaptersUnread).toHaveBeenCalledWith(
      2,
      mockNovel.id,
    );
    expect(state.getState().map(ch => ch.unread)).toEqual([true, true, false]);
  });

  it('markChaptersUnreadAction marks selected chapters unread in db and state', () => {
    const deps = createDeps();
    const state = createStateMutator([
      makeChapter(1, { unread: false }),
      makeChapter(2, { unread: false }),
    ]);

    markChaptersUnreadAction([makeChapter(2)], state.mutate, deps);

    expect(deps.markChaptersUnread).toHaveBeenCalledWith([2]);
    expect(state.getState().map(ch => ch.unread)).toEqual([false, true]);
  });

  it('marks chapters unread and resets progress only after both writes succeed', async () => {
    const deps = createDeps();
    const state = createStateMutator([
      makeChapter(1, { unread: false, progress: 75 }),
    ]);

    const success = await markChaptersUnreadAndResetProgressAction(
      [makeChapter(1)],
      state.mutate,
      deps,
    );

    expect(success).toBe(true);
    expect(deps.markChaptersUnread).toHaveBeenCalledWith([1]);
    expect(deps.updateChapterProgressByIds).toHaveBeenCalledWith([1], 0);
    expect(state.getState()[0]).toEqual(
      expect.objectContaining({ unread: true, progress: 0 }),
    );
  });

  it('keeps chapter state unchanged when unread reset persistence fails', async () => {
    const deps = createDeps();
    deps.updateChapterProgressByIds.mockRejectedValue(
      new Error('write failed'),
    );
    const original = makeChapter(1, { unread: false, progress: 75 });
    const state = createStateMutator([original]);

    const success = await markChaptersUnreadAndResetProgressAction(
      [makeChapter(1)],
      state.mutate,
      deps,
    );

    expect(success).toBe(false);
    expect(state.getState()[0]).toEqual(original);
    expect(deps.showToast).toHaveBeenCalledWith('write failed');
  });

  it('updateChapterProgressAction clamps persisted and in-memory progress values', () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1, { progress: 10 })]);

    updateChapterProgressAction(1, 145, state.mutate, deps);

    expect(deps.updateChapterProgress).toHaveBeenCalledWith(1, 100);
    expect(state.getState()[0].progress).toBe(100);
  });

  it('deleteChapterAction is safe no-op when novel is absent', async () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1), makeChapter(2)]);

    deleteChapterAction(makeChapter(1), undefined, state.mutate, deps);
    await Promise.resolve();

    expect(deps.deleteChapter).not.toHaveBeenCalled();
    expect(deps.showToast).not.toHaveBeenCalled();
    expect(state.getState().map(ch => ch.isDownloaded)).toEqual([true, true]);
  });

  it('deleteChapterAction updates downloaded flag and emits toast after delete resolves', async () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1), makeChapter(2)]);

    deleteChapterAction(makeChapter(2), mockNovel, state.mutate, deps);
    await Promise.resolve();

    expect(deps.deleteChapter).toHaveBeenCalledWith(
      mockNovel.pluginId,
      mockNovel.id,
      2,
    );
    expect(deps.getString).toHaveBeenCalledWith('common.deleted', {
      name: 'Chapter 2',
    });
    expect(deps.showToast).toHaveBeenCalledWith('common.deleted');
    expect(state.getState().map(ch => ch.isDownloaded)).toEqual([true, false]);
  });

  it('deleteChaptersAction updates selected chapters and toast payload after delete resolves', async () => {
    const deps = createDeps();
    const state = createStateMutator([
      makeChapter(1),
      makeChapter(2),
      makeChapter(3),
    ]);

    deleteChaptersAction(
      [makeChapter(1), makeChapter(3)],
      mockNovel,
      state.mutate,
      deps,
    );
    await Promise.resolve();

    expect(deps.deleteChapters).toHaveBeenCalledWith(
      mockNovel.pluginId,
      mockNovel.id,
      [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 3 })],
    );
    expect(deps.getString).toHaveBeenCalledWith(
      'updatesScreen.deletedChapters',
      {
        num: 2,
      },
    );
    expect(deps.showToast).toHaveBeenCalledWith(
      'updatesScreen.deletedChapters',
    );
    expect(state.getState().map(ch => ch.isDownloaded)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('refreshChaptersAction guards on missing novel/fetching and transforms fetched chapters', async () => {
    const deps = createDeps();
    const sourceChapters = [makeChapter(1), makeChapter(2)];
    deps.getPageChapters.mockResolvedValue(sourceChapters);
    const setChapters = jest.fn();

    refreshChaptersAction({
      novel: undefined,
      fetching: false,
      settingsSort: 'positionAsc',
      settingsFilter: [],
      currentPage: '1',
      transformChapters: chs => chs,
      setChapters,
      deps,
    });

    refreshChaptersAction({
      novel: mockNovel,
      fetching: true,
      settingsSort: 'positionAsc',
      settingsFilter: [],
      currentPage: '1',
      transformChapters: chs => chs,
      setChapters,
      deps,
    });

    expect(deps.getPageChapters).not.toHaveBeenCalled();

    refreshChaptersAction({
      novel: mockNovel,
      fetching: false,
      settingsSort: 'positionAsc',
      settingsFilter: [],
      currentPage: '2',
      transformChapters: chs => chs.map(ch => ({ ...ch, unread: false })),
      setChapters,
      deps,
    });
    await Promise.resolve();

    expect(deps.getPageChapters).toHaveBeenCalledWith(
      mockNovel.id,
      'positionAsc',
      [],
      '2',
    );
    expect(setChapters).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, unread: false }),
      expect.objectContaining({ id: 2, unread: false }),
    ]);
  });
  it('increaseTimeSpentAction accumulates timeSpent in db and state', () => {
    const deps = createDeps();
    const state = createStateMutator([
      makeChapter(1, { timeSpent: 500 }),
      makeChapter(2, { timeSpent: 500 }),
    ]);

    increaseTimeSpentAction(1, 200, state.mutate, deps);

    expect(deps.increaseTimeSpent).toHaveBeenCalledWith(1, 200);
    expect(state.getState().map(ch => ch.timeSpent)).toEqual([700, 500]);
  });

  it('increaseTimeSpentAction treats a missing timeSpent as 0 before adding', () => {
    const deps = createDeps();
    const state = createStateMutator([
      makeChapter(1, { timeSpent: undefined }),
    ]);

    increaseTimeSpentAction(1, 300, state.mutate, deps);

    expect(deps.increaseTimeSpent).toHaveBeenCalledWith(1, 300);
    expect(state.getState()[0].timeSpent).toBe(300);
  });

  it('increaseTimeSpentAction is a no-op on state for a chapterId not present', () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1, { timeSpent: 500 })]);

    increaseTimeSpentAction(999, 200, state.mutate, deps);

    expect(deps.increaseTimeSpent).toHaveBeenCalledWith(999, 200);
    expect(state.getState().map(ch => ch.timeSpent)).toEqual([500]);
  });

  it('increaseTimeSpentAction supports repeated calls accumulating on the same chapter', () => {
    const deps = createDeps();
    const state = createStateMutator([makeChapter(1, { timeSpent: 0 })]);

    increaseTimeSpentAction(1, 100, state.mutate, deps);
    increaseTimeSpentAction(1, 150, state.mutate, deps);

    expect(deps.increaseTimeSpent).toHaveBeenNthCalledWith(1, 1, 100);
    expect(deps.increaseTimeSpent).toHaveBeenNthCalledWith(2, 1, 150);
    expect(state.getState()[0].timeSpent).toBe(250);
  });
});
