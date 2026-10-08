import { downloadChapters } from '../downloadChapter';

const mockGetChapter = jest.fn();
const mockDeleteChapter = jest.fn();
const mockGetNovelById = jest.fn();
const mockGetPlugin = jest.fn();
const mockGetMMKVObject = jest.fn();
const mockWrite = jest.fn();
const mockDownloadFile = jest.fn();

jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: (...args: unknown[]) => mockGetChapter(...args),
  deleteChapter: (...args: unknown[]) => mockDeleteChapter(...args),
}));

jest.mock('@database/queries/NovelQueries', () => ({
  getNovelById: (...args: unknown[]) => mockGetNovelById(...args),
}));

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: (...args: unknown[]) => mockGetPlugin(...args),
}));

jest.mock('@plugins/helpers/fetch', () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: (...args: unknown[]) => mockGetMMKVObject(...args),
}));

jest.mock('@utils/sleep', () => ({
  sleep: jest.fn(() => Promise.resolve()),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@database/db', () => ({
  dbManager: {
    write: (...args: unknown[]) => mockWrite(...args),
  },
}));

jest.mock('@modules/native-file', () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn(() => Promise.resolve()),
    writeFile: jest.fn(() => Promise.resolve()),
  },
}));

/** The download only ever issues `update().set().where().run()`. */
const createTx = () => {
  const run = () => undefined;
  return {
    update: () => ({ set: () => ({ where: () => ({ run }) }) }),
  };
};

const novel = { id: 7, pluginId: 'plugin.reader', name: 'Novel Test' };

const makeChapter = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  novelId: 7,
  name: 'Chapter 1',
  path: '/chapter/1',
  unread: true,
  isDownloaded: false,
  ...overrides,
});

/**
 * `getChapter` is called twice per download: once up front and once by the
 * delete-after-read check, so the second return value models the chapter being
 * marked read while the download was in flight.
 */
const arrangeChapter = ({
  beforeDownload,
  afterDownload,
}: {
  beforeDownload: Record<string, unknown>;
  afterDownload: Record<string, unknown>;
}) => {
  mockGetChapter
    .mockResolvedValueOnce(makeChapter(beforeDownload))
    .mockResolvedValueOnce(makeChapter(afterDownload));
};

const runDownload = () =>
  downloadChapters(
    {
      novelName: novel.name,
      chapters: [{ chapterId: 1, chapterName: 'Chapter 1' }],
    },
    jest.fn(),
    { updateCheckpoint: jest.fn() } as any,
  );

describe('downloadChapters delete-after-read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWrite.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(createTx()),
    );
    mockGetNovelById.mockResolvedValue(novel);
    mockGetPlugin.mockReturnValue({
      id: 'plugin.reader',
      site: 'https://example.com',
      parseChapter: jest.fn(() => Promise.resolve('<p>body</p>')),
    });
  });

  it('removes content when the chapter was read while the task was queued', async () => {
    mockGetMMKVObject.mockReturnValue({ autoDeleteReadChapters: true });
    arrangeChapter({
      beforeDownload: { unread: true },
      afterDownload: { unread: false },
    });

    await runDownload();

    expect(mockDeleteChapter).toHaveBeenCalledWith(novel.pluginId, novel.id, 1);
  });

  it('keeps content when the chapter is still unread after the download', async () => {
    mockGetMMKVObject.mockReturnValue({ autoDeleteReadChapters: true });
    arrangeChapter({
      beforeDownload: { unread: true },
      afterDownload: { unread: true },
    });

    await runDownload();

    expect(mockDeleteChapter).not.toHaveBeenCalled();
  });

  it('keeps content when the setting is off', async () => {
    mockGetMMKVObject.mockReturnValue({ autoDeleteReadChapters: false });
    arrangeChapter({
      beforeDownload: { unread: true },
      afterDownload: { unread: false },
    });

    await runDownload();

    expect(mockDeleteChapter).not.toHaveBeenCalled();
  });

  it('keeps content when no app settings have been written yet', async () => {
    mockGetMMKVObject.mockReturnValue(undefined);
    arrangeChapter({
      beforeDownload: { unread: true },
      afterDownload: { unread: false },
    });

    await runDownload();

    expect(mockDeleteChapter).not.toHaveBeenCalled();
  });
});
