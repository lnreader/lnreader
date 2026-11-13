import { renderHook } from '@testing-library/react-native';
import { useNovelScreenActions } from '../useNovelScreenActions';

const mockDownloadChapters = jest.fn();
const mockGetUnread = jest.fn();
const mockGetAll = jest.fn();

jest.mock('@database/queries/ChapterQueries', () => ({
  getAllUndownloadedAndUnreadChapters: (...args: unknown[]) =>
    mockGetUnread(...args),
  getAllUndownloadedChapters: (...args: unknown[]) => mockGetAll(...args),
  getChaptersByIds: jest.fn(),
}));

jest.mock('@hooks/persisted', () => ({
  useDownload: () => ({ downloadChapters: mockDownloadChapters }),
}));

jest.mock('@services/plugin/fetch', () => ({ resolveUrl: jest.fn() }));

jest.mock('../../NovelContext', () => ({
  useNovelActions: () => ({
    bookmarkChapters: jest.fn(),
    deleteChapters: jest.fn(),
    markChaptersRead: jest.fn(),
    markChaptersUnreadAndResetProgress: jest.fn(),
    markPreviouschaptersRead: jest.fn(),
    markPreviousChaptersUnread: jest.fn(),
  }),
}));

const novel = { id: 1, name: 'Novel', pluginId: 'p', isLocal: false } as any;
const ch = (id: number) => ({ id, name: `Chapter ${id}` } as any);

const setup = (chapters: any[] = []) =>
  renderHook(() =>
    useNovelScreenActions({
      chapters,
      clearSelection: jest.fn(),
      novel,
      selectedIds: [],
      selectedChapters: [],
    }),
  ).result.current;

describe('downloadAvailableChapters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('downloads the next N unread chapters, continuing after read ones', async () => {
    // Chapters 1-283 are read and deleted, so only 284+ are unread.
    mockGetUnread.mockResolvedValue([ch(284), ch(285)]);

    await setup([ch(1), ch(2), ch(3)]).downloadAvailableChapters(2);

    expect(mockGetUnread).toHaveBeenCalledWith(1, 2);
    expect(mockDownloadChapters).toHaveBeenCalledWith(novel, [
      ch(284),
      ch(285),
    ]);
  });

  it('does not depend on the chapters currently shown on screen', async () => {
    mockGetUnread.mockResolvedValue([ch(10), ch(11)]);

    await setup([]).downloadAvailableChapters(5);

    expect(mockDownloadChapters).toHaveBeenCalledWith(novel, [ch(10), ch(11)]);
  });

  it('downloads nothing when there are no unread chapters left', async () => {
    mockGetUnread.mockResolvedValue([]);

    await setup().downloadAvailableChapters(10);

    expect(mockDownloadChapters).not.toHaveBeenCalled();
  });
});
