import { downloadChaptersAhead } from '../useDownload';

const mockGetFollowingChapters = jest.fn();
const mockEnqueue = jest.fn();
const mockGetMMKVObject = jest.fn();

jest.mock('@database/queries/ChapterQueries', () => ({
  getFollowingChapters: (...args: unknown[]) =>
    mockGetFollowingChapters(...args),
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: (...args: unknown[]) => mockGetMMKVObject(...args),
}));

jest.mock('@services/backgroundTasks', () => ({
  BACKGROUND_TASKS_STORE_KEY: 'BACKGROUND_TASKS',
  backgroundTasks: { enqueue: (...args: unknown[]) => mockEnqueue(...args) },
}));

jest.mock('react-native-mmkv', () => ({ useMMKVObject: jest.fn() }));

const novel = { id: 1, name: 'Novel', pluginId: 'plugin' } as any;
const current = { position: 0, page: '1' };
const ch = (id: number, isDownloaded = false) => ({
  id,
  name: `Chapter ${id}`,
  isDownloaded,
});
const queued = (...chapterIds: number[]) => [
  {
    task: {
      name: 'DOWNLOAD_CHAPTER',
      data: { chapters: chapterIds.map(chapterId => ({ chapterId })) },
    },
  },
];

describe('downloadChaptersAhead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMMKVObject.mockReturnValue(undefined);
  });

  it('enqueues the following chapters in order', async () => {
    mockGetFollowingChapters.mockResolvedValue([ch(2), ch(3)]);

    await downloadChaptersAhead(novel, current, 3);

    expect(mockGetFollowingChapters).toHaveBeenCalledWith(
      1,
      0,
      '1',
      3,
      undefined,
    );
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue.mock.calls[0][0].data.chapters).toEqual([
      { chapterId: 2, chapterName: 'Chapter 2' },
      { chapterId: 3, chapterName: 'Chapter 3' },
    ]);
  });

  it('skips chapters that are already downloaded', async () => {
    mockGetFollowingChapters.mockResolvedValue([ch(2, true), ch(3)]);

    await downloadChaptersAhead(novel, current, 3);

    expect(mockEnqueue.mock.calls[0][0].data.chapters).toEqual([
      { chapterId: 3, chapterName: 'Chapter 3' },
    ]);
  });

  it('skips chapters an earlier call already queued', async () => {
    mockGetFollowingChapters.mockResolvedValue([ch(2), ch(3), ch(4)]);
    mockGetMMKVObject.mockReturnValue(queued(2, 3));

    await downloadChaptersAhead(novel, current, 3);

    expect(mockEnqueue.mock.calls[0][0].data.chapters).toEqual([
      { chapterId: 4, chapterName: 'Chapter 4' },
    ]);
  });

  it('enqueues nothing when every candidate is downloaded or queued', async () => {
    mockGetFollowingChapters.mockResolvedValue([ch(2, true), ch(3)]);
    mockGetMMKVObject.mockReturnValue(queued(3));

    await downloadChaptersAhead(novel, current, 3);

    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
