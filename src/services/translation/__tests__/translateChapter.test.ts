import { translateChapterHtml } from '../translateChapter';
import { getTranslationProvider } from '../providers';
import { getApiKey } from '../secureStorage';
import { TranslationError, type TranslationConfig } from '../types';

jest.mock('../providers', () => ({ getTranslationProvider: jest.fn() }));
jest.mock('../secureStorage', () => ({ getApiKey: jest.fn() }));

const mockedGetProvider = getTranslationProvider as jest.MockedFunction<
  typeof getTranslationProvider
>;
const mockedGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;

const config: TranslationConfig = {
  provider: 'libretranslate',
  endpoint: 'https://example.test',
  requiresApiKey: false,
};

/** Builds a document with `count` paragraphs of predictable text. */
const buildHtml = (count: number) =>
  Array.from({ length: count }, (_, i) => `<p>src${i}</p>`).join('');

const installProvider = (
  translateBatch: jest.Mock,
  overrides: { requiresApiKey?: boolean } = {},
) => {
  mockedGetProvider.mockReturnValue({
    id: 'libretranslate',
    isLocal: false,
    requiresApiKey: () => overrides.requiresApiKey ?? false,
    defaultConfig: config,
    translateBatch,
  } as unknown as ReturnType<typeof getTranslationProvider>);
};

/** Uppercases each input, so output is verifiably derived from the source. */
const upperBatch = jest.fn(async (texts: string[]) =>
  texts.map(t => t.toUpperCase()),
);

beforeEach(() => {
  mockedGetApiKey.mockResolvedValue(undefined);
  upperBatch.mockClear();
});

describe('translateChapterHtml', () => {
  it('translates every segment and reports completion', async () => {
    installProvider(upperBatch);

    const result = await translateChapterHtml({
      html: buildHtml(3),
      config,
      targetLang: 'fr',
      chunkSize: 10,
      requestDelayMs: 0,
    });

    expect(result.complete).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.html).toContain('SRC0');
    expect(result.html).toContain('SRC2');
  });

  it('short-circuits a document with no translatable text', async () => {
    installProvider(upperBatch);

    const result = await translateChapterHtml({
      html: '<div><img src="a.png"></div>',
      config,
      targetLang: 'fr',
    });

    expect(result.empty).toBe(true);
    expect(result.complete).toBe(true);
    expect(upperBatch).not.toHaveBeenCalled();
  });

  it('splits the document across chunks of the configured size', async () => {
    installProvider(upperBatch);

    const result = await translateChapterHtml({
      html: buildHtml(5),
      config,
      targetLang: 'fr',
      chunkSize: 2,
      requestDelayMs: 0,
    });

    expect(upperBatch).toHaveBeenCalledTimes(3);
    expect(result.totalChunks).toBe(3);
  });

  it('keeps successful chunks when one chunk fails', async () => {
    // The core resilience requirement: a failed chunk must cost only its own
    // paragraphs, not the chapter.
    const flaky = jest.fn(async (texts: string[]) => {
      if (texts[0] === 'src2') {
        throw new TranslationError('rate-limit', 'slow down');
      }
      return texts.map(t => t.toUpperCase());
    });
    installProvider(flaky);

    const result = await translateChapterHtml({
      html: buildHtml(6),
      config,
      targetLang: 'fr',
      chunkSize: 2,
      requestDelayMs: 0,
    });

    expect(result.complete).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.html).toContain('SRC0');
    expect(result.html).toContain('SRC4');
    // The failed chunk's paragraphs survive untranslated rather than vanishing.
    expect(result.html).toContain('src2');
    expect(result.html).toContain('src3');
  });

  it('records the failed segment range and whether it is retryable', async () => {
    installProvider(
      jest.fn(async () => {
        throw new TranslationError('rate-limit', 'slow down');
      }),
    );

    const result = await translateChapterHtml({
      html: buildHtml(4),
      config,
      targetLang: 'fr',
      chunkSize: 2,
      requestDelayMs: 0,
    });

    expect(result.failures).toEqual([
      expect.objectContaining({
        chunkIndex: 0,
        start: 0,
        count: 2,
        kind: 'rate-limit',
        retryable: true,
      }),
      expect.objectContaining({ chunkIndex: 1, start: 2, count: 2 }),
    ]);
  });

  it('marks an auth failure as not retryable', async () => {
    installProvider(
      jest.fn(async () => {
        throw new TranslationError('auth', 'bad key');
      }),
    );

    const result = await translateChapterHtml({
      html: buildHtml(1),
      config,
      targetLang: 'fr',
      requestDelayMs: 0,
    });

    expect(result.failures[0]).toMatchObject({
      kind: 'auth',
      retryable: false,
    });
  });

  it('rejects a provider response whose length does not match the input', async () => {
    // A short array means paragraphs were merged or dropped; writing it back
    // would misalign every later paragraph in the chunk.
    installProvider(jest.fn(async () => ['only one']));

    const result = await translateChapterHtml({
      html: buildHtml(3),
      config,
      targetLang: 'fr',
      chunkSize: 3,
      requestDelayMs: 0,
    });

    expect(result.complete).toBe(false);
    expect(result.failures[0].kind).toBe('bad-response');
    expect(result.html).toContain('src0');
    expect(result.html).not.toContain('only one');
  });

  it('translates only the requested chunks when retrying', async () => {
    installProvider(upperBatch);

    await translateChapterHtml({
      html: buildHtml(6),
      config,
      targetLang: 'fr',
      chunkSize: 2,
      requestDelayMs: 0,
      onlyChunks: new Set([1]),
    });

    expect(upperBatch).toHaveBeenCalledTimes(1);
    expect(upperBatch).toHaveBeenCalledWith(
      ['src2', 'src3'],
      expect.anything(),
    );
  });

  it('reports progress against the number of chunks actually run', async () => {
    installProvider(upperBatch);
    const onProgress = jest.fn();

    await translateChapterHtml({
      html: buildHtml(4),
      config,
      targetLang: 'fr',
      chunkSize: 2,
      requestDelayMs: 0,
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('fails fast when the provider needs a key and none is stored', async () => {
    installProvider(upperBatch, { requiresApiKey: true });
    mockedGetApiKey.mockResolvedValue(undefined);

    await expect(
      translateChapterHtml({ html: buildHtml(1), config, targetLang: 'fr' }),
    ).rejects.toThrow(TranslationError);
    expect(upperBatch).not.toHaveBeenCalled();
  });

  it('passes the stored key and languages through to the provider', async () => {
    installProvider(upperBatch, { requiresApiKey: true });
    mockedGetApiKey.mockResolvedValue('secret-key');

    await translateChapterHtml({
      html: buildHtml(1),
      config,
      targetLang: 'ja',
      sourceLang: 'ko',
      requestDelayMs: 0,
    });

    expect(upperBatch).toHaveBeenCalledWith(
      ['src0'],
      expect.objectContaining({
        apiKey: 'secret-key',
        sourceLang: 'ko',
        targetLang: 'ja',
      }),
    );
  });

  it('aborts the run when the caller cancels', async () => {
    const controller = new AbortController();
    installProvider(
      jest.fn(async (texts: string[]) => {
        controller.abort();
        return texts.map(t => t.toUpperCase());
      }),
    );

    await expect(
      translateChapterHtml({
        html: buildHtml(4),
        config,
        targetLang: 'fr',
        chunkSize: 2,
        requestDelayMs: 0,
        signal: controller.signal,
      }),
    ).rejects.toThrow(TranslationError);
  });

  it('gives each chunk a signal that is not already aborted', async () => {
    const seen: boolean[] = [];
    installProvider(
      jest.fn(async (texts: string[], ctx: { signal: AbortSignal }) => {
        seen.push(ctx.signal.aborted);
        return texts.map(t => t.toUpperCase());
      }),
    );

    await translateChapterHtml({
      html: buildHtml(4),
      config,
      targetLang: 'fr',
      chunkSize: 2,
      requestDelayMs: 0,
    });

    expect(seen).toEqual([false, false]);
  });
});
