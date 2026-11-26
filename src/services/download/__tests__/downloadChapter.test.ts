import NativeFile from '@modules/native-file';
import { getChapterDownloadCooldownMs } from '@hooks/persisted/useSettings';
import { createPluginError } from '@plugins/helpers/pluginError';
import { PluginError } from '@plugins/types';
import type {
  BackgroundTaskExecutionContext,
  BackgroundTaskMetadata,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { sleep } from '@utils/sleep';
import { downloadChapters } from '../downloadChapter';

const mockParseChapter = jest.fn<Promise<string>, [string]>();

jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: async (id: number) => ({ id, novelId: 1, path: String(id) }),
}));

jest.mock('@database/queries/NovelQueries', () => ({
  getNovelById: () => ({ id: 1, pluginId: 'source' }),
}));

jest.mock('@database/db', () => ({ dbManager: { write: jest.fn() } }));
jest.mock('@hooks/persisted/useSettings', () => ({
  getChapterDownloadCooldownMs: jest.fn(() => 0),
}));
jest.mock('@plugins/helpers/fetch', () => ({ downloadFile: jest.fn() }));
jest.mock('@plugins/pluginManager', () => ({
  getPlugin: () => ({ id: 'source', parseChapter: mockParseChapter }),
}));
jest.mock('@utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

const batch = {
  novelName: 'Example Novel',
  chapters: [1, 2, 3, 4].map(chapterId => ({
    chapterId,
    chapterName: `Chapter ${chapterId}`,
  })),
};

describe('download warnings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getChapterDownloadCooldownMs).mockReturnValue(0);
    jest.mocked(sleep).mockResolvedValue(undefined);
    mockParseChapter.mockReset().mockResolvedValue('<p>Chapter text</p>');
  });

  it('warns on the first failure and still processes the rest of the batch', async () => {
    mockParseChapter.mockImplementation(async path => {
      if (path === '2' || path === '3') throw new Error('Source unavailable');
      return '<p>Chapter text</p>';
    });
    const postWarning = jest.fn(async () => {
      expect(mockParseChapter.mock.calls).toEqual([['1'], ['2']]);
    });

    await expect(
      downloadChapters(batch, jest.fn(), {
        postWarning,
        updateCheckpoint: jest.fn(),
      }),
    ).rejects.toThrow('2 of 4 chapters failed');

    expect(postWarning).toHaveBeenCalledTimes(1);
    expect(postWarning).toHaveBeenCalledWith(
      'Chapter download failed for Example Novel',
      'Chapter 2: Source unavailable',
    );
    expect(mockParseChapter.mock.calls).toEqual([['1'], ['2'], ['3'], ['4']]);
    expect(NativeFile.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/4\/index\.html$/),
      expect.stringContaining('Chapter text'),
    );
  });

  it('includes checkpointed failures in the summary without warning again', async () => {
    mockParseChapter.mockRejectedValueOnce(new Error('Source unavailable'));
    const postWarning = jest.fn();

    await expect(
      downloadChapters(batch, jest.fn(), {
        checkpoint: JSON.stringify({
          nextIndex: 2,
          failures: ['Chapter 2: Source unavailable'],
        }),
        postWarning,
        updateCheckpoint: jest.fn(),
      }),
    ).rejects.toThrow('2 of 4 chapters failed');

    expect(postWarning).not.toHaveBeenCalled();
    expect(mockParseChapter.mock.calls).toEqual([['3'], ['4']]);
  });
});

const baseMeta: BackgroundTaskMetadata = {
  name: 'Download',
  isRunning: true,
  progress: 0,
  progressText: '',
};

describe('download rate-limit retry', () => {
  const updateCheckpoint = jest.fn<Promise<void>, [string]>();
  const postWarning = jest.fn<Promise<void>, [string, string]>();

  const setupContext = (): BackgroundTaskExecutionContext => ({
    updateCheckpoint,
    postWarning,
  });

  const singleChapterBatch = {
    novelName: 'Test Novel',
    chapters: [{ chapterId: 1, chapterName: 'Chapter 1' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(sleep).mockResolvedValue(undefined);
    jest.mocked(getChapterDownloadCooldownMs).mockReturnValue(1000);
    updateCheckpoint.mockReset().mockResolvedValue(undefined);
    postWarning.mockReset().mockResolvedValue(undefined);
    mockParseChapter.mockReset();
  });

  it('retries once after backoff on a 429 rate-limit error and saves clean checkpoint on success', async () => {
    mockParseChapter
      .mockRejectedValueOnce(
        createPluginError(PluginError.RateLimited, { status: 429 }),
      )
      .mockResolvedValueOnce('<p>Chapter 1 content</p>');

    const setMeta: TaskProgressUpdater = jest.fn(transformer => {
      transformer(baseMeta);
    });

    await expect(
      downloadChapters(singleChapterBatch, setMeta, setupContext()),
    ).resolves.toBeUndefined();

    expect(mockParseChapter).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3500);
    expect(postWarning).not.toHaveBeenCalled();
    expect(updateCheckpoint).toHaveBeenCalledWith(
      JSON.stringify({ nextIndex: 1, failures: [] }),
    );
  });

  it('records failure in checkpoint, posts warning once, and throws when the rate-limit retry also fails', async () => {
    const rateLimitError = createPluginError(PluginError.RateLimited, {
      status: 429,
    });
    mockParseChapter
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError);

    const setMeta: TaskProgressUpdater = jest.fn();

    await expect(
      downloadChapters(singleChapterBatch, setMeta, setupContext()),
    ).rejects.toThrow(
      `1 of 1 chapters failed: Chapter 1: ${PluginError.RateLimited}`,
    );

    expect(mockParseChapter).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3500);
    expect(postWarning).toHaveBeenCalledTimes(1);
    expect(postWarning).toHaveBeenCalledWith(
      'Chapter download failed for Test Novel',
      `Chapter 1: ${PluginError.RateLimited}`,
    );
    expect(updateCheckpoint).toHaveBeenCalledWith(
      JSON.stringify({
        nextIndex: 1,
        failures: [`Chapter 1: ${PluginError.RateLimited}`],
      }),
    );
  });

  it('does not retry on ordinary non-rate-limit errors', async () => {
    mockParseChapter.mockRejectedValueOnce(
      createPluginError(PluginError.EmptyContent),
    );

    const setMeta: TaskProgressUpdater = jest.fn();

    await expect(
      downloadChapters(singleChapterBatch, setMeta, setupContext()),
    ).rejects.toThrow(
      `1 of 1 chapters failed: Chapter 1: ${PluginError.EmptyContent}`,
    );

    expect(mockParseChapter).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(postWarning).toHaveBeenCalledTimes(1);
    expect(updateCheckpoint).toHaveBeenCalledWith(
      JSON.stringify({
        nextIndex: 1,
        failures: [`Chapter 1: ${PluginError.EmptyContent}`],
      }),
    );
  });

  it('aborts before retrying if the task is paused during rate-limit backoff', async () => {
    mockParseChapter.mockRejectedValueOnce(
      createPluginError(PluginError.RateLimited, { status: 429 }),
    );

    let paused = false;
    jest.mocked(sleep).mockImplementationOnce(async () => {
      paused = true;
    });

    const setMeta: TaskProgressUpdater = jest.fn(() => {
      if (paused) {
        throw new Error('Background task pause');
      }
    });

    await expect(
      downloadChapters(singleChapterBatch, setMeta, setupContext()),
    ).rejects.toThrow('Background task pause');

    expect(mockParseChapter).toHaveBeenCalledTimes(1);
    expect(updateCheckpoint).not.toHaveBeenCalled();
    expect(postWarning).not.toHaveBeenCalled();
  });
});
