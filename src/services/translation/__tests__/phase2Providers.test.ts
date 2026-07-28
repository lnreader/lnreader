import {
  openAIProvider,
  deepSeekProvider,
} from '../providers/openaiCompatible';
import { microsoftProvider } from '../providers/microsoft';
import { systranProvider } from '../providers/systran';
import {
  customHttpProvider,
  fillHttpTemplate,
  resolveJsonPath,
} from '../providers/customHttp';
import { TRANSLATION_PROVIDER_IDS, getTranslationProvider } from '../providers';
import {
  TranslationError,
  type CustomHttpConfig,
  type MicrosoftConfig,
  type OpenAICompatibleConfig,
  type SystranConfig,
} from '../types';

const signal = () => new AbortController().signal;

const mockFetch = (body: unknown, ok = true, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
};

const lastCall = () => (global.fetch as jest.Mock).mock.calls[0];

describe('registry after Phase 2', () => {
  it('registers all ten providers', () => {
    expect(TRANSLATION_PROVIDER_IDS).toHaveLength(10);
  });

  it('resolves every id to a provider carrying that id', () => {
    for (const id of TRANSLATION_PROVIDER_IDS) {
      expect(getTranslationProvider(id).id).toBe(id);
    }
  });

  it('gives every provider a default config with a matching discriminant', () => {
    for (const id of TRANSLATION_PROVIDER_IDS) {
      expect(getTranslationProvider(id).defaultConfig.provider).toBe(id);
    }
  });
});

describe('openAI-compatible providers', () => {
  const config: OpenAICompatibleConfig = {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    systemPrompt: 'sys',
    userPromptTemplate: '{TEXT}',
  };
  const ctx = {
    config,
    apiKey: 'k',
    sourceLang: 'auto',
    targetLang: 'fr',
    signal: signal(),
  };

  it('returns the parsed JSON array from the assistant message', async () => {
    mockFetch({ choices: [{ message: { content: '["un","deux"]' } }] });

    await expect(
      openAIProvider.translateBatch(['one', 'two'], ctx),
    ).resolves.toEqual(['un', 'deux']);
  });

  it('posts to the chat-completions path with bearer auth', async () => {
    mockFetch({ choices: [{ message: { content: '["un"]' } }] });
    await openAIProvider.translateBatch(['one'], ctx);

    const [url, init] = lastCall();
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer k');
    expect(JSON.parse(init.body).model).toBe('gpt-4o-mini');
  });

  it('requires an API key before making a request', async () => {
    mockFetch({});
    await expect(
      openAIProvider.translateBatch(['one'], { ...ctx, apiKey: undefined }),
    ).rejects.toMatchObject({ kind: 'auth' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces a provider error payload', async () => {
    mockFetch({ error: { message: 'quota exceeded' } });
    await expect(openAIProvider.translateBatch(['one'], ctx)).rejects.toThrow(
      /quota exceeded/,
    );
  });

  it('reports an empty completion rather than returning nothing', async () => {
    mockFetch({ choices: [{ message: {}, finish_reason: 'length' }] });
    await expect(openAIProvider.translateBatch(['one'], ctx)).rejects.toThrow(
      /finish reason: length/,
    );
  });

  it('shares the implementation but keeps distinct defaults', () => {
    expect(deepSeekProvider.id).toBe('deepseek');
    expect(deepSeekProvider.defaultConfig.endpoint).toContain('deepseek');
    expect(openAIProvider.defaultConfig.endpoint).toContain('openai');
  });
});

describe('microsoftProvider', () => {
  const config: MicrosoftConfig = {
    provider: 'microsoft',
    endpoint: 'https://api.cognitive.microsofttranslator.com',
    region: '',
  };
  const ctx = {
    config,
    apiKey: 'k',
    sourceLang: 'auto',
    targetLang: 'fr',
    signal: signal(),
  };

  it('maps the nested translations array back to plain strings', async () => {
    mockFetch([
      { translations: [{ text: 'un' }] },
      { translations: [{ text: 'deux' }] },
    ]);

    await expect(
      microsoftProvider.translateBatch(['one', 'two'], ctx),
    ).resolves.toEqual(['un', 'deux']);
  });

  it('omits `from` for auto-detect rather than sending the literal "auto"', async () => {
    mockFetch([{ translations: [{ text: 'un' }] }]);
    await microsoftProvider.translateBatch(['one'], ctx);

    expect(lastCall()[0]).not.toContain('from=');
    expect(lastCall()[0]).toContain('to=fr');
  });

  it('sends an explicit source language when one is set', async () => {
    mockFetch([{ translations: [{ text: 'un' }] }]);
    await microsoftProvider.translateBatch(['one'], {
      ...ctx,
      sourceLang: 'ko',
    });

    expect(lastCall()[0]).toContain('from=ko');
  });

  it('sends the region header only for regional resources', async () => {
    mockFetch([{ translations: [{ text: 'un' }] }]);
    await microsoftProvider.translateBatch(['one'], ctx);
    expect(lastCall()[1].headers).not.toHaveProperty(
      'Ocp-Apim-Subscription-Region',
    );

    mockFetch([{ translations: [{ text: 'un' }] }]);
    await microsoftProvider.translateBatch(['one'], {
      ...ctx,
      config: { ...config, region: 'westeurope' },
    });
    expect(lastCall()[1].headers['Ocp-Apim-Subscription-Region']).toBe(
      'westeurope',
    );
  });

  it('rejects a result count that does not match the input', async () => {
    mockFetch([{ translations: [{ text: 'un' }] }]);
    await expect(
      microsoftProvider.translateBatch(['one', 'two'], ctx),
    ).rejects.toThrow(TranslationError);
  });
});

describe('systranProvider', () => {
  const config: SystranConfig = {
    provider: 'systran',
    endpoint: 'https://api-translate.systran.net',
  };
  const ctx = {
    config,
    apiKey: 'k',
    sourceLang: 'auto',
    targetLang: 'fr',
    signal: signal(),
  };

  it('returns outputs in order', async () => {
    mockFetch({ outputs: [{ output: 'un' }, { output: 'deux' }] });

    await expect(
      systranProvider.translateBatch(['one', 'two'], ctx),
    ).resolves.toEqual(['un', 'deux']);
  });

  it('authenticates with a Key-scheme header', async () => {
    mockFetch({ outputs: [{ output: 'un' }] });
    await systranProvider.translateBatch(['one'], ctx);
    expect(lastCall()[1].headers.Authorization).toBe('Key k');
  });

  it('reports a per-segment error', async () => {
    mockFetch({ outputs: [{ error: { message: 'unsupported pair' } }] });
    await expect(systranProvider.translateBatch(['one'], ctx)).rejects.toThrow(
      /unsupported pair/,
    );
  });
});

describe('resolveJsonPath', () => {
  const body = { data: { translations: [{ text: 'hi' }, { text: 'yo' }] } };

  it('walks object and array segments', () => {
    expect(resolveJsonPath(body, 'data.translations.0.text')).toBe('hi');
    expect(resolveJsonPath(body, 'data.translations.1.text')).toBe('yo');
  });

  it('returns the whole body for an empty path', () => {
    expect(resolveJsonPath(body, '')).toBe(body);
  });

  it('returns undefined for a miss instead of throwing', () => {
    expect(resolveJsonPath(body, 'data.nope.text')).toBeUndefined();
    expect(resolveJsonPath(body, 'data.translations.9.text')).toBeUndefined();
    expect(resolveJsonPath(body, 'data.translations.x')).toBeUndefined();
  });
});

describe('fillHttpTemplate', () => {
  const values = {
    texts: ['a', 'b'],
    text: 'a"quoted"',
    sourceLang: 'ko',
    targetLang: 'fr',
  };

  it('serialises {texts} as a JSON array', () => {
    expect(fillHttpTemplate('{"q":{texts}}', values)).toBe('{"q":["a","b"]}');
  });

  it('escapes {text_esc} so it stays valid inside a JSON string', () => {
    const filled = fillHttpTemplate('{"q":"{text_esc}"}', values);
    expect(() => JSON.parse(filled)).not.toThrow();
    expect(JSON.parse(filled).q).toBe('a"quoted"');
  });

  it('leaves {text} raw for non-JSON bodies', () => {
    expect(fillHttpTemplate('q={text}', values)).toBe('q=a"quoted"');
  });

  it('substitutes language codes', () => {
    expect(fillHttpTemplate('{source}->{target}', values)).toBe('ko->fr');
  });

  it('does not let {source} clobber {source_name}', () => {
    // Both start with the same prefix, so ordering inside the helper matters.
    const filled = fillHttpTemplate('{source_name}|{target_name}', values);
    expect(filled).not.toContain('_name');
  });
});

describe('customHttpProvider', () => {
  const config: CustomHttpConfig = {
    provider: 'customhttp',
    url: 'https://example.test/tr',
    method: 'POST',
    headersTemplate: '{"Authorization":"Bearer {apiKey}"}',
    bodyTemplate: '{"q":{texts},"target":"{target}"}',
    responsePath: 'translatedText',
  };
  const ctx = {
    config,
    apiKey: 'k',
    sourceLang: 'auto',
    targetLang: 'fr',
    signal: signal(),
  };

  it('batches the chunk when the template uses {texts}', async () => {
    mockFetch({ translatedText: ['un', 'deux'] });

    await expect(
      customHttpProvider.translateBatch(['one', 'two'], ctx),
    ).resolves.toEqual(['un', 'deux']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('substitutes the api key into headers', async () => {
    mockFetch({ translatedText: ['un'] });
    await customHttpProvider.translateBatch(['one'], ctx);
    expect(lastCall()[1].headers.Authorization).toBe('Bearer k');
  });

  it('sends one request per segment for a {text} template', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ translatedText: 'un' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ translatedText: 'deux' }),
        text: async () => '',
      }) as unknown as typeof fetch;

    await expect(
      customHttpProvider.translateBatch(['one', 'two'], {
        ...ctx,
        config: { ...config, bodyTemplate: '{"q":"{text_esc}"}' },
      }),
    ).resolves.toEqual(['un', 'deux']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects a batch response that is not an array', async () => {
    mockFetch({ translatedText: 'un' });
    await expect(
      customHttpProvider.translateBatch(['one'], ctx),
    ).rejects.toThrow(/expected an array/);
  });

  it('rejects a batch length mismatch', async () => {
    mockFetch({ translatedText: ['un'] });
    await expect(
      customHttpProvider.translateBatch(['one', 'two'], ctx),
    ).rejects.toThrow(/1 results for 2 inputs/);
  });

  it('names the path when the response has no text there', async () => {
    mockFetch({ somethingElse: 'un' });
    await expect(
      customHttpProvider.translateBatch(['one'], {
        ...ctx,
        config: { ...config, bodyTemplate: '{"q":"{text_esc}"}' },
      }),
    ).rejects.toThrow(/translatedText/);
  });

  it('reports invalid header JSON as a config error', async () => {
    mockFetch({ translatedText: ['un'] });
    await expect(
      customHttpProvider.translateBatch(['one'], {
        ...ctx,
        config: { ...config, headersTemplate: 'not json' },
      }),
    ).rejects.toMatchObject({ kind: 'config' });
  });

  it('refuses to run without a URL', async () => {
    mockFetch({});
    await expect(
      customHttpProvider.translateBatch(['one'], {
        ...ctx,
        config: { ...config, url: '' },
      }),
    ).rejects.toMatchObject({ kind: 'config' });
  });
});
