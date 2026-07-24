import { ChapterInfo, NovelInfo } from '@database/types';
import { createNovelStoreActions } from '../store/novelStore.actions';
import {
  NovelStoreDependencies,
  NovelStoreState,
  SetState,
} from '../store/novelStore.types';

const novel: NovelInfo = {
  id: 1,
  pluginId: 'test-plugin',
  path: '/novel/test',
  name: 'Test novel',
  inLibrary: false,
  totalPages: 2,
};

const chapter = (id: number): ChapterInfo =>
  ({
    id,
    novelId: novel.id,
    name: `Chapter ${id}`,
    path: `/chapter/${id}`,
    chapterNumber: id,
    unread: true,
    isDownloaded: false,
    bookmark: false,
    progress: 0,
    page: String(id),
  } as ChapterInfo);

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('novelStore actions', () => {
  it('ignores stale chapter responses and keeps fetching active', async () => {
    const first = deferred<{
      chapters: ChapterInfo[];
      batchInformation: { batch: number; total: number };
      firstUnreadChapter: ChapterInfo | undefined;
    }>();
    const second = deferred<{
      chapters: ChapterInfo[];
      batchInformation: { batch: number; total: number };
      firstUnreadChapter: ChapterInfo | undefined;
    }>();
    const getChaptersForPage = jest
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    let requestVersion = 0;

    let state = {
      novel,
      novelPath: novel.path,
      pluginId: novel.pluginId,
      pages: ['1', '2'],
      pageIndex: 0,
      novelSettings: {
        sort: 'positionAsc',
        filter: [],
        showChapterTitles: true,
      },
      fetching: false,
      chapters: [],
    } as unknown as NovelStoreState;

    const set: SetState = partial => {
      const update = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...update };
    };
    const deps = {
      bootstrapService: { getChaptersForPage },
      chapterRequestCoordinator: {
        current: jest.fn(() => requestVersion),
        invalidate: jest.fn(() => ++requestVersion),
      },
      transformChapters: (chapters: ChapterInfo[]) => chapters,
    } as unknown as NovelStoreDependencies;
    const actions = createNovelStoreActions({
      set,
      get: () => state,
      deps,
      defaultChapterSort: 'positionAsc',
    });
    state = {
      ...state,
      actions: actions as NovelStoreState['actions'],
    };

    const firstRequest = actions.getChapters();
    actions.setPageIndex(1);
    const secondRequest = actions.getChapters();

    first.resolve({
      chapters: [chapter(1)],
      batchInformation: { batch: 0, total: 0 },
      firstUnreadChapter: chapter(1),
    });
    await firstRequest;

    expect(state.fetching).toBe(true);
    expect(state.chapters).toEqual([]);

    second.resolve({
      chapters: [chapter(2)],
      batchInformation: { batch: 0, total: 0 },
      firstUnreadChapter: chapter(2),
    });
    await secondRequest;

    expect(state.fetching).toBe(false);
    expect(state.chapters.map(item => item.id)).toEqual([2]);
  });
});
