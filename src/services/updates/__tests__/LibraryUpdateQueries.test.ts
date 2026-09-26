import { fetchNovel, fetchPage } from '@services/plugin/fetch';
import { getPlugin, getPluginPageOrder } from '@plugins/pluginManager';
import { insertChapters } from '@database/queries/ChapterQueries';
import { updateNovel } from '../LibraryUpdateQueries';

jest.mock('@services/plugin/fetch', () => ({
  fetchNovel: jest.fn(),
  fetchPage: jest.fn(),
}));

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: jest.fn(),
  getPluginPageOrder: jest.fn(() => 'ASC'),
  LOCAL_PLUGIN_ID: 'local',
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  insertChapters: jest.fn(),
  resequenceNovelChapters: jest.fn(),
}));

jest.mock('@utils/Storages', () => ({ NOVEL_STORAGE: '/mock/storage' }));
jest.mock('@plugins/helpers/fetch', () => ({ downloadFile: jest.fn() }));
jest.mock('@modules/native-file', () => ({
  __esModule: true,
  default: { exists: jest.fn(() => true), mkdir: jest.fn() },
}));

/** Paths already stored for the novel; drives the "is this chapter new" check. */
let mockStoredPaths: string[] = [];
let mockStoredTotalPages = 0;

jest.mock('@database/db', () => {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    get: async () => ({ totalPages: mockStoredTotalPages }),
    all: async () => mockStoredPaths.map(path => ({ path })),
  };
  return {
    dbManager: {
      select: () => chain,
      write: async (cb: (tx: any) => unknown) =>
        cb({
          update: () => ({ set: () => ({ where: () => ({ run: () => {} }) }) }),
        }),
    },
  };
});

const mockedFetchNovel = jest.mocked(fetchNovel);
const mockedFetchPage = jest.mocked(fetchPage);
const mockedGetPlugin = jest.mocked(getPlugin);
const mockedGetPluginPageOrder = jest.mocked(getPluginPageOrder);
const mockedInsertChapters = jest.mocked(insertChapters);

/** A DESC source: page 1 holds the newest chapters. */
const descendingPages = (total: number, pageSize: number) => {
  const newestFirst = Array.from({ length: total }, (_, i) => total - i);
  const pages: { name: string; path: string }[][] = [];
  for (let i = 0; i < newestFirst.length; i += pageSize) {
    pages.push(
      newestFirst.slice(i, i + pageSize).map(n => ({
        name: `Chapter ${n}`,
        path: `/c/${n}`,
      })),
    );
  }
  return pages;
};

describe('updateNovel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoredPaths = [];
    mockStoredTotalPages = 0;
    mockedGetPlugin.mockReturnValue({ parsePage: jest.fn() } as any);
    mockedGetPluginPageOrder.mockReturnValue('ASC');
    mockedInsertChapters.mockResolvedValue(undefined);
  });

  describe('DESC sources', () => {
    beforeEach(() => mockedGetPluginPageOrder.mockReturnValue('DESC'));

    it('fetches no extra pages when page 1 has nothing new', async () => {
      const pages = descendingPages(9, 3);
      mockStoredTotalPages = 3;
      mockStoredPaths = pages.flat().map(chapter => chapter.path);
      mockedFetchNovel.mockResolvedValue({
        name: 'Novel',
        path: '/n',
        chapters: pages[0],
        totalPages: 3,
      } as any);

      await updateNovel('plugin', '/n', 1, {});

      expect(mockedFetchPage).not.toHaveBeenCalled();
    });

    it('refetches every page once a new chapter appears on page 1', async () => {
      const before = descendingPages(9, 3);
      const after = descendingPages(10, 3);
      mockStoredTotalPages = 3;
      mockStoredPaths = before.flat().map(chapter => chapter.path);
      mockedFetchNovel.mockResolvedValue({
        name: 'Novel',
        path: '/n',
        chapters: after[0],
        totalPages: 4,
      } as any);
      mockedFetchPage.mockImplementation(async (_id, _path, page) => ({
        chapters: after[Number(page) - 1] ?? [],
      }));

      await updateNovel('plugin', '/n', 1, {});

      expect(mockedFetchPage.mock.calls.map(call => call[2])).toEqual([
        '2',
        '3',
        '4',
      ]);
    });
    it('refetches every page when a long absence spans several pages of new chapters', async () => {
      // 30 chapters known, 12 published since: pages 1 and 2 are entirely new.
      const before = descendingPages(30, 10);
      const after = descendingPages(42, 10);
      mockStoredTotalPages = 3;
      mockStoredPaths = before.flat().map(chapter => chapter.path);
      mockedFetchNovel.mockResolvedValue({
        name: 'Novel',
        path: '/n',
        chapters: after[0],
        totalPages: 5,
      } as any);
      mockedFetchPage.mockImplementation(async (_id, _path, page) => ({
        chapters: after[Number(page) - 1] ?? [],
      }));

      await updateNovel('plugin', '/n', 1, {});

      expect(mockedFetchPage.mock.calls.map(call => call[2])).toEqual([
        '2',
        '3',
        '4',
        '5',
      ]);
    });

    it('fetches page 1 itself when parseNovel returns metadata only', async () => {
      const after = descendingPages(10, 3);
      mockStoredTotalPages = 3;
      mockStoredPaths = [];
      mockedFetchNovel.mockResolvedValue({
        name: 'Novel',
        path: '/n',
        chapters: [],
        totalPages: 4,
      } as any);
      mockedFetchPage.mockImplementation(async (_id, _path, page) => ({
        chapters: after[Number(page) - 1] ?? [],
      }));

      await updateNovel('plugin', '/n', 1, {});

      // Page 1 is fetched to decide, then the rest follow.
      expect(mockedFetchPage.mock.calls.map(call => call[2])).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
    });
  });

  describe('ASC sources', () => {
    it('refetches the last known page and any pages added after it', async () => {
      mockStoredTotalPages = 2;
      mockStoredPaths = ['/c/1'];
      mockedFetchNovel.mockResolvedValue({
        name: 'Novel',
        path: '/n',
        chapters: [{ name: 'Chapter 1', path: '/c/1' }],
        totalPages: 4,
      } as any);
      mockedFetchPage.mockResolvedValue({ chapters: [] } as any);

      await updateNovel('plugin', '/n', 1, {});

      expect(mockedFetchPage.mock.calls.map(call => call[2])).toEqual([
        '2',
        '3',
        '4',
      ]);
    });
  });
});
