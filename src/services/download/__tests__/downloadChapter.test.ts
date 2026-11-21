import NativeFile from '@modules/native-file';
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
  getChapterDownloadCooldownMs: () => 0,
}));
jest.mock('@plugins/helpers/fetch', () => ({ downloadFile: jest.fn() }));
jest.mock('@plugins/pluginManager', () => ({
  getPlugin: () => ({ id: 'source', parseChapter: mockParseChapter }),
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
