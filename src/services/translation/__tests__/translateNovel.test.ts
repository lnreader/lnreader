import NativeFile from '@modules/native-file';

import { translateNovelChapters } from '../translateNovel';
import { parseTranslationCheckpoint } from '../translationCheckpoint';
import { hasTranslatedChapter } from '../storage';
import { translateChapter } from '../translateChapter';
import { fetchChapter } from '@services/plugin/fetch';
import { sanitizeChapterText } from '@screens/reader/utils/sanitizeChapterText';
import { getTranslationSettings } from '@hooks/persisted/useTranslationSettings';
import { getNovelTranslationSettings } from '@hooks/persisted/useNovelTranslationSettings';

jest.mock('../storage', () => ({ hasTranslatedChapter: jest.fn() }));
jest.mock('../translateChapter', () => ({ translateChapter: jest.fn() }));
jest.mock('@services/plugin/fetch', () => ({ fetchChapter: jest.fn() }));
jest.mock('@screens/reader/utils/sanitizeChapterText', () => ({
  sanitizeChapterText: jest.fn((_p, _n, _c, text) => `sanitized:${text}`),
}));
jest.mock('@hooks/persisted/useTranslationSettings', () => ({
  getTranslationSettings: jest.fn(),
}));
jest.mock('@hooks/persisted/useNovelTranslationSettings', () => ({
  getNovelTranslationSettings: jest.fn(),
}));

const mockedHasTranslated = hasTranslatedChapter as jest.MockedFunction<
  typeof hasTranslatedChapter
>;
const mockedTranslate = translateChapter as jest.MockedFunction<
  typeof translateChapter
>;
const mockedFetchChapter = fetchChapter as jest.MockedFunction<
  typeof fetchChapter
>;
const mockedSettings = getTranslationSettings as jest.MockedFunction<
  typeof getTranslationSettings
>;
const mockedNovelSettings = getNovelTranslationSettings as jest.MockedFunction<
  typeof getNovelTranslationSettings
>;

const data = {
  novelId: 1,
  novelName: 'Novel',
  pluginId: 'plug',
  chapters: [
    { chapterId: 10, chapterName: 'Ch 1', chapterPath: '/c1' },
    { chapterId: 11, chapterName: 'Ch 2', chapterPath: '/c2' },
  ],
};

const okResult = {
  html: '<p>t</p>',
  totalChunks: 1,
  failures: [],
  complete: true,
  empty: false,
};

let setMeta: jest.Mock;
let updateCheckpoint: jest.Mock;

const run = (checkpoint?: string) =>
  translateNovelChapters(data, setMeta, { checkpoint, updateCheckpoint });

beforeEach(() => {
  jest.clearAllMocks();
  setMeta = jest.fn();
  updateCheckpoint = jest.fn().mockResolvedValue(undefined);
  mockedSettings.mockReturnValue({
    enabled: true,
    config: {
      provider: 'libretranslate',
      endpoint: 'https://example.test',
      requiresApiKey: false,
    },
    targetLang: 'fr',
    sourceLang: 'auto',
    chunkSize: 40,
    requestDelayMs: 0,
    requestTimeoutMs: 1000,
  } as unknown as ReturnType<typeof getTranslationSettings>);
  mockedNovelSettings.mockReturnValue({ autoTranslate: false });
  mockedHasTranslated.mockResolvedValue(false);
  mockedTranslate.mockResolvedValue(okResult);
  (NativeFile.readFile as jest.Mock).mockResolvedValue('<p>downloaded</p>');
});

describe('translateNovelChapters', () => {
  it('translates every chapter in order', async () => {
    await run();

    expect(mockedTranslate).toHaveBeenCalledTimes(2);
    expect(mockedTranslate.mock.calls[0][0]).toEqual({
      pluginId: 'plug',
      novelId: 1,
      chapterId: 10,
    });
    expect(mockedTranslate.mock.calls[1][0]).toMatchObject({ chapterId: 11 });
  });

  it('does nothing for a novel with no chapters', async () => {
    await translateNovelChapters({ ...data, chapters: [] }, setMeta, {
      updateCheckpoint,
    });
    expect(mockedTranslate).not.toHaveBeenCalled();
  });

  it('sanitizes chapter HTML before translating it', async () => {
    // The reader renders cached translations directly, so unsanitized markup
    // written here would end up on screen.
    await run();

    expect(sanitizeChapterText).toHaveBeenCalled();
    expect(mockedTranslate.mock.calls[0][1].html).toBe(
      'sanitized:<p>downloaded</p>',
    );
  });

  it('falls back to the plugin when the chapter is not downloaded', async () => {
    (NativeFile.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    mockedFetchChapter.mockResolvedValue('<p>fetched</p>');

    await run();

    expect(mockedFetchChapter).toHaveBeenCalledWith('plug', '/c1');
    expect(mockedTranslate.mock.calls[0][1].html).toBe(
      'sanitized:<p>fetched</p>',
    );
  });

  it('skips chapters already translated into the target language', async () => {
    mockedHasTranslated.mockImplementation(async location =>
      location.chapterId === 10 ? true : false,
    );

    await run();

    expect(mockedTranslate).toHaveBeenCalledTimes(1);
    expect(mockedTranslate.mock.calls[0][0]).toMatchObject({ chapterId: 11 });
  });

  it('uses the per-novel language override when set', async () => {
    mockedNovelSettings.mockReturnValue({
      autoTranslate: false,
      targetLang: 'de',
    });

    await run();

    expect(mockedTranslate.mock.calls[0][1].targetLang).toBe('de');
  });

  it('falls back to the global language with no override', async () => {
    await run();
    expect(mockedTranslate.mock.calls[0][1].targetLang).toBe('fr');
  });

  it('checkpoints after every chapter so a killed run resumes', async () => {
    await run();

    expect(updateCheckpoint).toHaveBeenCalledTimes(2);
    expect(JSON.parse(updateCheckpoint.mock.calls[0][0])).toEqual({
      nextIndex: 1,
      failures: [],
    });
    expect(JSON.parse(updateCheckpoint.mock.calls[1][0]).nextIndex).toBe(2);
  });

  it('resumes from a checkpoint instead of redoing paid work', async () => {
    await run(JSON.stringify({ nextIndex: 1, failures: [] }));

    expect(mockedTranslate).toHaveBeenCalledTimes(1);
    expect(mockedTranslate.mock.calls[0][0]).toMatchObject({ chapterId: 11 });
  });

  it('keeps going after one chapter fails and reports it at the end', async () => {
    mockedTranslate.mockImplementation(async location =>
      location.chapterId === 10 ? Promise.reject(new Error('boom')) : okResult,
    );

    await expect(run()).rejects.toThrow(/Ch 1: boom/);
    // The second chapter still ran despite the first failing.
    expect(mockedTranslate).toHaveBeenCalledTimes(2);
  });

  it('records a partially translated chapter as a failure', async () => {
    mockedTranslate.mockResolvedValue({
      html: '<p>t</p>',
      totalChunks: 4,
      failures: [
        {
          chunkIndex: 0,
          start: 0,
          count: 40,
          kind: 'rate-limit' as const,
          retryable: true,
          message: 'slow down',
        },
      ],
      complete: false,
      empty: false,
    });

    await expect(run()).rejects.toThrow(/1\/4 sections failed/);
  });

  it('carries prior failures across a resume', async () => {
    mockedTranslate.mockResolvedValue(okResult);

    await expect(
      run(JSON.stringify({ nextIndex: 1, failures: ['Ch 1: earlier'] })),
    ).rejects.toThrow(/Ch 1: earlier/);
  });

  it('reports progress per chapter and finishes at 1', async () => {
    await run();

    const states = setMeta.mock.calls.map(([fn]) => fn({}));
    expect(states[0]).toMatchObject({ isRunning: true, progress: 0 });
    expect(states[states.length - 1]).toMatchObject({
      isRunning: false,
      progress: 1,
    });
  });
});

describe('parseTranslationCheckpoint', () => {
  it('starts from zero with no checkpoint', () => {
    expect(parseTranslationCheckpoint(undefined, 5)).toEqual({
      nextIndex: 0,
      failures: [],
    });
  });

  it('round-trips a valid checkpoint', () => {
    expect(
      parseTranslationCheckpoint(
        JSON.stringify({ nextIndex: 2, failures: ['a'] }),
        5,
      ),
    ).toEqual({ nextIndex: 2, failures: ['a'] });
  });

  it('clamps an index past the end of a shorter chapter list', () => {
    expect(
      parseTranslationCheckpoint(JSON.stringify({ nextIndex: 99 }), 5),
    ).toMatchObject({ nextIndex: 5 });
  });

  it('recovers from malformed data rather than throwing', () => {
    expect(parseTranslationCheckpoint('not json', 5)).toEqual({
      nextIndex: 0,
      failures: [],
    });
    expect(
      parseTranslationCheckpoint(JSON.stringify({ nextIndex: 'x' }), 5),
    ).toMatchObject({ nextIndex: 0 });
  });

  it('drops non-string entries from failures', () => {
    expect(
      parseTranslationCheckpoint(
        JSON.stringify({ nextIndex: 1, failures: ['a', 3, null] }),
        5,
      ),
    ).toMatchObject({ failures: ['a'] });
  });
});
