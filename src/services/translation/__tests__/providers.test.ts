import { libreTranslateProvider } from '../providers/libretranslate';
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT_TEMPLATE,
  encodeBatch,
  parseJsonArrayResponse,
  fillPromptTemplate,
} from '../providers/llm';
import { trimTrailingSlash } from '../providers/http';
import {
  TRANSLATION_PROVIDER_IDS,
  getDefaultConfig,
  getTranslationProvider,
  isLocalProvider,
} from '../providers';
import { TranslationError, type LibreTranslateConfig } from '../types';

const ctx = (config: LibreTranslateConfig, apiKey?: string) => ({
  config,
  apiKey,
  sourceLang: 'auto',
  targetLang: 'fr',
  signal: new AbortController().signal,
});

const config: LibreTranslateConfig = {
  provider: 'libretranslate',
  endpoint: 'https://example.test',
  requiresApiKey: false,
};

const mockFetchJson = (body: unknown, ok = true, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
};

describe('provider registry', () => {
  it('still registers the Phase 1 providers', () => {
    // Copied before sorting: TRANSLATION_PROVIDER_IDS is a shared module-level
    // array, and sorting it in place would reorder it for every other test.
    // The exhaustive count lives in phase2Providers.test.ts.
    expect([...TRANSLATION_PROVIDER_IDS].sort()).toEqual(
      expect.arrayContaining(['gemini', 'libretranslate', 'ollama']),
    );
  });

  it('resolves each id to a provider carrying that id', () => {
    for (const id of TRANSLATION_PROVIDER_IDS) {
      expect(getTranslationProvider(id).id).toBe(id);
    }
  });

  it('returns a default config whose discriminant matches its id', () => {
    for (const id of TRANSLATION_PROVIDER_IDS) {
      expect(getDefaultConfig(id).provider).toBe(id);
    }
  });

  it('marks only Ollama as local', () => {
    expect(isLocalProvider('ollama')).toBe(true);
    expect(isLocalProvider('gemini')).toBe(false);
    expect(isLocalProvider('libretranslate')).toBe(false);
  });
});

describe('libreTranslateProvider', () => {
  it('returns the translated segments in order', async () => {
    mockFetchJson({ translatedText: ['un', 'deux'] });

    await expect(
      libreTranslateProvider.translateBatch(['one', 'two'], ctx(config)),
    ).resolves.toEqual(['un', 'deux']);
  });

  it('accepts a bare string when a single segment was sent', async () => {
    mockFetchJson({ translatedText: 'un' });

    await expect(
      libreTranslateProvider.translateBatch(['one'], ctx(config)),
    ).resolves.toEqual(['un']);
  });

  it('rejects a response with the wrong number of segments', async () => {
    mockFetchJson({ translatedText: ['un'] });

    await expect(
      libreTranslateProvider.translateBatch(['one', 'two'], ctx(config)),
    ).rejects.toThrow(TranslationError);
  });

  it('omits the api key field when none is configured', async () => {
    mockFetchJson({ translatedText: ['un'] });
    await libreTranslateProvider.translateBatch(['one'], ctx(config));

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).not.toHaveProperty('api_key');
    expect(body.target).toBe('fr');
  });

  it('classifies an auth rejection as non-retryable', async () => {
    mockFetchJson({ error: 'nope' }, false, 403);

    await expect(
      libreTranslateProvider.translateBatch(['one'], ctx(config)),
    ).rejects.toMatchObject({ kind: 'auth', retryable: false });
  });

  it('classifies a 429 as a retryable rate limit', async () => {
    mockFetchJson({ error: 'slow down' }, false, 429);

    await expect(
      libreTranslateProvider.translateBatch(['one'], ctx(config)),
    ).rejects.toMatchObject({ kind: 'rate-limit', retryable: true });
  });

  it('reports whether a key is required from its config', () => {
    expect(libreTranslateProvider.requiresApiKey(config)).toBe(false);
    expect(
      libreTranslateProvider.requiresApiKey({
        ...config,
        requiresApiKey: true,
      }),
    ).toBe(true);
  });
});

describe('trimTrailingSlash', () => {
  it('normalises user-entered server URLs', () => {
    expect(trimTrailingSlash('http://host:11434/')).toBe('http://host:11434');
    expect(trimTrailingSlash('http://host:11434///')).toBe('http://host:11434');
    expect(trimTrailingSlash('http://host:11434')).toBe('http://host:11434');
  });
});

describe('fillPromptTemplate', () => {
  it('substitutes every placeholder occurrence', () => {
    const filled = fillPromptTemplate(
      '{TARGET_LANG}: {TEXT} ({SOURCE_LANG} -> {TARGET_LANG})',
      { sourceLang: 'ko', targetLang: 'en', text: '["hi"]' },
    );
    expect(filled).toBe('en: ["hi"] (ko -> en)');
  });

  it('renders the shipped default template without leftover placeholders', () => {
    const filled = fillPromptTemplate(DEFAULT_USER_PROMPT_TEMPLATE, {
      sourceLang: 'auto',
      targetLang: 'en',
      text: encodeBatch(['a']),
    });
    expect(filled).not.toMatch(/\{(SOURCE_LANG|TARGET_LANG|TEXT)\}/);
  });

  it('ships a non-empty default system prompt', () => {
    expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});

describe('parseJsonArrayResponse', () => {
  it('parses a bare JSON array', () => {
    expect(parseJsonArrayResponse('["a","b"]', 2, 'Test')).toEqual(['a', 'b']);
  });

  it('tolerates a markdown code fence around the array', () => {
    expect(
      parseJsonArrayResponse('```json\n["a","b"]\n```', 2, 'Test'),
    ).toEqual(['a', 'b']);
    expect(parseJsonArrayResponse('```\n["a"]\n```', 1, 'Test')).toEqual(['a']);
  });

  it('rejects a length mismatch rather than padding it', () => {
    expect(() => parseJsonArrayResponse('["a"]', 2, 'Test')).toThrow(
      TranslationError,
    );
  });

  it('rejects non-array JSON', () => {
    expect(() => parseJsonArrayResponse('{"a":1}', 1, 'Test')).toThrow(
      TranslationError,
    );
  });

  it('rejects unparseable output', () => {
    expect(() => parseJsonArrayResponse('not json', 1, 'Test')).toThrow(
      TranslationError,
    );
  });

  it('coerces non-string array entries', () => {
    expect(parseJsonArrayResponse('[1,"b"]', 2, 'Test')).toEqual(['1', 'b']);
  });
});
