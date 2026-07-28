import { translateChapterHtml } from '../translateChapter';
import { getTranslationProvider } from '../providers';
import { getApiKey } from '../secureStorage';
import {
  MAX_PARALLEL_TRANSLATIONS,
  clampParallelTranslations,
  DEFAULT_MAX_PARALLEL_TRANSLATIONS,
} from '../chunking';
import type { TranslationConfig } from '../types';

jest.mock('../providers', () => ({ getTranslationProvider: jest.fn() }));
jest.mock('../secureStorage', () => ({ getApiKey: jest.fn() }));

const mockedGetProvider = getTranslationProvider as jest.MockedFunction<
  typeof getTranslationProvider
>;
const mockedGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;

const config = {
  provider: 'ollama',
  endpoint: 'http://127.0.0.1:11434',
  model: 'llama3.1',
  systemPrompt: 's',
  userPromptTemplate: '{TEXT}',
} as TranslationConfig;

const buildHtml = (count: number) =>
  Array.from({ length: count }, (_, i) => `<p>src${i}</p>`).join('');

/**
 * Records how many chunk requests are in flight at once, which is the only
 * thing that actually distinguishes the parallel path from the sequential one.
 */
const makeTrackingProvider = (isLocal: boolean) => {
  const state = { inFlight: 0, peak: 0, calls: 0 };
  const translateBatch = jest.fn(async (texts: string[]) => {
    state.calls += 1;
    state.inFlight += 1;
    state.peak = Math.max(state.peak, state.inFlight);
    await new Promise(resolve => setTimeout(resolve, 5));
    state.inFlight -= 1;
    return texts.map(t => t.toUpperCase());
  });

  mockedGetProvider.mockReturnValue({
    id: 'ollama',
    isLocal,
    requiresApiKey: () => false,
    defaultConfig: config,
    translateBatch,
  } as unknown as ReturnType<typeof getTranslationProvider>);

  return state;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetApiKey.mockResolvedValue(undefined);
});

describe('clampParallelTranslations', () => {
  it('keeps a value inside the supported range', () => {
    expect(clampParallelTranslations(4)).toBe(4);
  });

  it('clamps to the documented bounds', () => {
    expect(clampParallelTranslations(0)).toBe(1);
    expect(clampParallelTranslations(-3)).toBe(1);
    expect(clampParallelTranslations(999)).toBe(MAX_PARALLEL_TRANSLATIONS);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampParallelTranslations(NaN)).toBe(
      DEFAULT_MAX_PARALLEL_TRANSLATIONS,
    );
  });
});

describe('parallel chunk execution', () => {
  it('runs chunks concurrently for a local provider', async () => {
    const state = makeTrackingProvider(true);

    await translateChapterHtml({
      html: buildHtml(8),
      config,
      targetLang: 'fr',
      chunkSize: 1,
      requestDelayMs: 0,
      maxParallel: 4,
    });

    expect(state.calls).toBe(8);
    expect(state.peak).toBeGreaterThan(1);
    expect(state.peak).toBeLessThanOrEqual(4);
  });

  it('never exceeds the configured parallelism', async () => {
    const state = makeTrackingProvider(true);

    await translateChapterHtml({
      html: buildHtml(10),
      config,
      targetLang: 'fr',
      chunkSize: 1,
      requestDelayMs: 0,
      maxParallel: 2,
    });

    expect(state.peak).toBeLessThanOrEqual(2);
  });

  it('stays sequential for a cloud provider even when parallelism is set', async () => {
    // Firing concurrent requests at a rate-limited API converts throughput
    // into 429s, so the setting must not apply there.
    const state = makeTrackingProvider(false);

    await translateChapterHtml({
      html: buildHtml(6),
      config,
      targetLang: 'fr',
      chunkSize: 1,
      requestDelayMs: 0,
      maxParallel: 4,
    });

    expect(state.peak).toBe(1);
  });

  it('stays sequential for a local provider at parallelism 1', async () => {
    const state = makeTrackingProvider(true);

    await translateChapterHtml({
      html: buildHtml(4),
      config,
      targetLang: 'fr',
      chunkSize: 1,
      requestDelayMs: 0,
      maxParallel: 1,
    });

    expect(state.peak).toBe(1);
  });

  it('keeps segments aligned with their source positions when parallel', async () => {
    makeTrackingProvider(true);

    const result = await translateChapterHtml({
      html: buildHtml(6),
      config,
      targetLang: 'fr',
      chunkSize: 1,
      requestDelayMs: 0,
      maxParallel: 3,
    });

    // Out-of-order completion must not scramble the document.
    const order = [...result.html.matchAll(/SRC(\d)/g)].map(m => m[1]);
    expect(order).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(result.complete).toBe(true);
  });

  it('collects per-chunk failures without losing the rest', async () => {
    const translateBatch = jest.fn(async (texts: string[]) => {
      if (texts[0] === 'src2') {
        throw new Error('boom');
      }
      return texts.map(t => t.toUpperCase());
    });
    mockedGetProvider.mockReturnValue({
      id: 'ollama',
      isLocal: true,
      requiresApiKey: () => false,
      defaultConfig: config,
      translateBatch,
    } as unknown as ReturnType<typeof getTranslationProvider>);

    const result = await translateChapterHtml({
      html: buildHtml(5),
      config,
      targetLang: 'fr',
      chunkSize: 1,
      requestDelayMs: 0,
      maxParallel: 3,
    });

    expect(result.complete).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.html).toContain('src2');
    expect(result.html).toContain('SRC0');
    expect(result.html).toContain('SRC4');
  });

  it('reports progress once per chunk', async () => {
    makeTrackingProvider(true);
    const onProgress = jest.fn();

    await translateChapterHtml({
      html: buildHtml(6),
      config,
      targetLang: 'fr',
      chunkSize: 1,
      requestDelayMs: 0,
      maxParallel: 3,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(6);
    // Counts are monotonic even though chunks finish out of order.
    const counts = onProgress.mock.calls.map(([completed]) => completed);
    expect(counts).toEqual([1, 2, 3, 4, 5, 6]);
    expect(onProgress).toHaveBeenLastCalledWith(6, 6);
  });
});
