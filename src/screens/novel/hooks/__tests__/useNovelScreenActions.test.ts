import { renderHook } from '@testing-library/react-native';
import { useNovelScreenActions } from '../useNovelScreenActions';

const mockDeleteChapters = jest.fn();
const mockGetDownloaded = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@utils/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getAllUndownloadedAndUnreadChapters: jest.fn(),
  getAllUndownloadedChapters: jest.fn(),
  getChaptersByIds: jest.fn(),
  getNovelDownloadedChapters: (...args: unknown[]) =>
    mockGetDownloaded(...args),
}));

jest.mock('@hooks/persisted', () => ({
  useDownload: () => ({ downloadChapters: jest.fn() }),
}));

jest.mock('@services/plugin/fetch', () => ({ resolveUrl: jest.fn() }));

jest.mock('../../NovelContext', () => ({
  useNovelActions: () => ({
    bookmarkChapters: jest.fn(),
    deleteChapters: mockDeleteChapters,
    markChaptersRead: jest.fn(),
    markChaptersUnreadAndResetProgress: jest.fn(),
    markPreviouschaptersRead: jest.fn(),
    markPreviousChaptersUnread: jest.fn(),
  }),
}));

const novel = { id: 1, name: 'Novel', pluginId: 'p', isLocal: false } as any;
const ch = (id: number) => ({ id, isDownloaded: true } as any);
const flush = () => new Promise(resolve => setImmediate(resolve));

const setup = (chapters: any[] = [], withNovel = true) =>
  renderHook(() =>
    useNovelScreenActions({
      chapters,
      clearSelection: jest.fn(),
      novel: withNovel ? novel : undefined,
      selectedIds: [],
      selectedChapters: [],
    }),
  ).result.current;

describe('deleteDownloadedChapters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes every downloaded chapter, not only the ones loaded on screen', async () => {
    mockGetDownloaded.mockResolvedValue([ch(1), ch(2), ch(900), ch(1500)]);

    setup([ch(1), ch(2)]).deleteDownloadedChapters();
    await flush();

    expect(mockGetDownloaded).toHaveBeenCalledWith(1);
    expect(mockDeleteChapters).toHaveBeenCalledWith([1, 2, 900, 1500]);
  });

  it('does nothing when no chapter is downloaded', async () => {
    mockGetDownloaded.mockResolvedValue([]);

    setup().deleteDownloadedChapters();
    await flush();

    expect(mockDeleteChapters).not.toHaveBeenCalled();
  });

  it('tells the user when the lookup fails instead of failing silently', async () => {
    mockGetDownloaded.mockRejectedValue(new Error('db failed'));

    setup().deleteDownloadedChapters();
    await flush();

    expect(mockShowToast).toHaveBeenCalledWith('db failed');
    expect(mockDeleteChapters).not.toHaveBeenCalled();
  });

  it('does nothing without a novel', async () => {
    setup([], false).deleteDownloadedChapters();
    await flush();

    expect(mockGetDownloaded).not.toHaveBeenCalled();
    expect(mockDeleteChapters).not.toHaveBeenCalled();
  });
});
