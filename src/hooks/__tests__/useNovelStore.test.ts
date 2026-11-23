import './mocks';

import { NovelInfo } from '@database/types';
import { createStore } from '@hooks/persisted/useNovel/store/createStore';
import { getNovelById } from '@database/queries/NovelQueries';
import { novelPersistence } from '@hooks/persisted/useNovel/store-helper/persistence';

const defaultSort = 'positionAsc';

const mockNovel: NovelInfo = {
  id: 1,
  pluginId: 'plugin-id',
  path: '/novel/path',
  name: 'Novel',
  cover: '',
  summary: '',
  author: '',
  artist: '',
  genres: 'Genre1, Genre2',
  status: 'Unknown',
  totalPages: 0,
  inLibrary: false,
};

const createNovelStore = (
  overrides: Partial<NovelInfo> = {},
  switchNovelToLibrary = jest.fn().mockResolvedValue(true),
) =>
  createStore({
    pluginId: 'plugin-id',
    path: '/novel/path',
    novel: { ...mockNovel, ...overrides },
    defaultChapterSort: defaultSort,
    switchNovelToLibrary,
  });

describe('useNovel store', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(novelPersistence, 'readLastRead').mockReturnValue(undefined);
    jest.spyOn(novelPersistence, 'readPageIndex').mockReturnValue(0);
    jest.spyOn(novelPersistence, 'readSettings').mockReturnValue({
      sort: defaultSort,
      filter: [],
      showChapterTitles: true,
    });
    jest
      .spyOn(novelPersistence, 'writePageIndex')
      .mockImplementation(() => undefined);
    jest
      .spyOn(novelPersistence, 'writeSettings')
      .mockImplementation(() => undefined);
  });

  it('hydrates persisted page index and settings defaults', () => {
    jest.spyOn(novelPersistence, 'readPageIndex').mockReturnValue(3);
    jest.spyOn(novelPersistence, 'readSettings').mockReturnValue({
      filter: ['read'],
      showChapterTitles: false,
    });

    const store = createNovelStore();

    expect(store.getState().pageIndex).toBe(3);
    expect(store.getState().novelSettings).toEqual({
      sort: defaultSort,
      filter: ['read'],
      showChapterTitles: false,
    });
  });

  it('persists page index updates through actions', () => {
    const writePageIndex = jest.spyOn(novelPersistence, 'writePageIndex');
    const store = createNovelStore();

    store.getState().actions.setPageIndex(2);

    expect(store.getState().pageIndex).toBe(2);
    expect(writePageIndex).toHaveBeenCalledWith(
      { pluginId: 'plugin-id', novelPath: '/novel/path' },
      2,
    );
  });

  it('persists novel settings updates through actions', () => {
    const writeSettings = jest.spyOn(novelPersistence, 'writeSettings');
    const store = createNovelStore();

    store.getState().actions.setNovelSettings({
      sort: 'positionDesc',
      filter: ['downloaded'],
      showChapterTitles: false,
    });

    expect(store.getState().novelSettings).toEqual({
      sort: 'positionDesc',
      filter: ['downloaded'],
      showChapterTitles: false,
    });
    expect(writeSettings).toHaveBeenCalledWith(
      { pluginId: 'plugin-id', novelPath: '/novel/path' },
      {
        sort: 'positionDesc',
        filter: ['downloaded'],
        showChapterTitles: false,
      },
    );
  });

  it('updates chapterTextCache via cache action helpers', () => {
    const store = createNovelStore();
    const cache = store.getState().actions.chapterTextCache;

    cache.write(10, 'chapter text');
    expect(store.getState().chapterTextCache).toEqual({ 10: 'chapter text' });
    expect(cache.read(10)).toBe('chapter text');

    cache.remove(10);
    expect(cache.read(10)).toBeUndefined();

    cache.write(11, 'next chapter');
    cache.clear();
    expect(store.getState().chapterTextCache).toEqual({});
  });

  it('toggles follow state after followNovel action', async () => {
    const switchNovelToLibrary = jest.fn().mockResolvedValue(true);
    const store = createNovelStore({ inLibrary: false }, switchNovelToLibrary);

    await store.getState().actions.followNovel();

    expect(switchNovelToLibrary).toHaveBeenCalledWith(
      '/novel/path',
      'plugin-id',
    );
    expect(store.getState().novel?.inLibrary).toBe(true);
  });

  it('shows the schedule worked out when a novel is followed', async () => {
    jest.mocked(getNovelById).mockReturnValue({
      fetchInterval: 3,
      nextUpdate: '2026-11-25T00:00:00.000Z',
    } as ReturnType<typeof getNovelById>);
    const store = createNovelStore({ inLibrary: false });

    await store.getState().actions.followNovel();

    expect(store.getState().novel).toMatchObject({
      inLibrary: true,
      fetchInterval: 3,
      nextUpdate: '2026-11-25T00:00:00.000Z',
    });
  });
});
