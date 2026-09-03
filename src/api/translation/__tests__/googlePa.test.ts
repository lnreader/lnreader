import {
  resolveGooglePaApiKeys,
  translateViaGooglePa,
} from '@api/translation/googlePa';
import { fetchTimeout } from '@utils/fetch/fetch';

jest.mock('@utils/fetch/fetch', () => ({ fetchTimeout: jest.fn() }));

const mockFetchTimeout = fetchTimeout as jest.MockedFunction<
  typeof fetchTimeout
>;

const response = (
  body: unknown,
  opts: { ok?: boolean; status?: number } = {},
): never =>
  ({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as never);

const paUrl = 'https://translate-pa.googleapis.com/v1/translateHtml';

describe('googlePa key resolution', () => {
  it('prefers the stored key list, then legacy key, then community key', () => {
    expect(
      resolveGooglePaApiKeys({
        googlePaApiKeys: 'k1\nk2',
        googlePaApiKey: '',
        useCommunityGooglePaKey: true,
      }),
    ).toEqual(['k1', 'k2']);
    expect(
      resolveGooglePaApiKeys({
        googlePaApiKeys: '',
        googlePaApiKey: 'legacy',
        useCommunityGooglePaKey: true,
      }),
    ).toEqual(['legacy']);
    expect(
      resolveGooglePaApiKeys({
        googlePaApiKeys: '',
        googlePaApiKey: '',
        useCommunityGooglePaKey: true,
      }),
    ).toEqual(['AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520']);
    expect(
      resolveGooglePaApiKeys({
        googlePaApiKeys: '',
        googlePaApiKey: '',
        useCommunityGooglePaKey: false,
      }),
    ).toEqual([]);
  });
});

describe('translateViaGooglePa', () => {
  beforeEach(() => {
    mockFetchTimeout.mockReset();
  });

  it('serves a fresh cached key without probing and maps back by index', async () => {
    mockFetchTimeout.mockResolvedValue(response([['Hello<br>World']]));
    const out = await translateViaGooglePa(['Hola', 'Mundo'], {
      apiKeys: ['k1'],
      cachedKey: 'cached-key',
      keyLastChecked: Date.now(),
      sourceLanguage: 'es',
      targetLanguage: 'en',
    });
    expect(out).toEqual(['Hello', 'World']);
    const [url, init] = mockFetchTimeout.mock.calls[0];
    expect(url).toBe(paUrl);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Goog-API-Key']).toBe('cached-key');
    expect(headers.Origin).toBe('https://translate.google.com');
    expect(JSON.stringify((init as RequestInit).body)).toContain('wt_lib');
    expect(mockFetchTimeout).toHaveBeenCalledTimes(1);
  });

  it('keeps blank paragraphs aligned instead of dropping them', async () => {
    mockFetchTimeout.mockResolvedValue(response([['Hello<br><br>World']]));
    const out = await translateViaGooglePa(['Hola', '', 'Mundo'], {
      apiKeys: ['k1'],
      cachedKey: 'cached-key',
      keyLastChecked: Date.now(),
      sourceLanguage: 'es',
      targetLanguage: 'en',
    });
    expect(out).toEqual(['Hello', '', 'World']);
  });

  it('unescapes HTML entities in the translation', async () => {
    mockFetchTimeout.mockResolvedValue(
      response([['Hello &amp; goodbye&nbsp;!&#233;']]),
    );
    const out = await translateViaGooglePa(['hola'], {
      apiKeys: ['k1'],
      cachedKey: 'cached-key',
      keyLastChecked: Date.now(),
      sourceLanguage: 'es',
      targetLanguage: 'en',
    });
    expect(out).toEqual(['Hello & goodbye !é']);
  });

  it('probes configured keys on an expired cache and persists the winner', async () => {
    mockFetchTimeout.mockResolvedValue(response([['Hello']]));
    const persistKeyCache = jest.fn();
    const out = await translateViaGooglePa(['Hola'], {
      apiKeys: ['k1'],
      cachedKey: 'stale-key',
      keyLastChecked: 0,
      persistKeyCache,
      sourceLanguage: 'es',
      targetLanguage: 'en',
    });
    expect(out).toEqual(['Hello']);
    // first call = key check, second = the real translation
    const edgeFirstKey = (
      (mockFetchTimeout.mock.calls[0][1] as RequestInit).headers as Record<
        string,
        string
      >
    )['X-Goog-API-Key'];
    const edgeTranslationKey = (
      (mockFetchTimeout.mock.calls[1][1] as RequestInit).headers as Record<
        string,
        string
      >
    )['X-Goog-API-Key'];
    expect(edgeFirstKey).toBe('k1');
    expect(edgeTranslationKey).toBe('k1');
    expect(persistKeyCache).toHaveBeenCalledWith('k1', expect.any(Number));
  });

  it('discovers a working key from wtr-lab when configured keys all fail', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(
        response('<p>test</p>', { ok: false, status: 403 }),
      )
      .mockResolvedValueOnce(
        response('<html><a href="/en/novel/arcane-academy">x</a></html>'),
      )
      .mockResolvedValueOnce(
        response('<html>...{"X-Goog-API-Key":"discovered-key"}...</html>'),
      )
      .mockResolvedValue(response([['Hello']]));
    const persistApiKeys = jest.fn();
    const persistKeyCache = jest.fn();
    const out = await translateViaGooglePa(['Hola'], {
      apiKeys: ['dead-key'],
      cachedKey: '',
      keyLastChecked: 0,
      persistApiKeys,
      persistKeyCache,
      sourceLanguage: 'es',
      targetLanguage: 'en',
    });
    expect(out).toEqual(['Hello']);
    expect(persistApiKeys).toHaveBeenCalledWith(['discovered-key', 'dead-key']);
    expect(persistKeyCache).toHaveBeenCalledWith(
      'discovered-key',
      expect.any(Number),
    );
    const translationKey = (
      (mockFetchTimeout.mock.calls.at(-1)![1] as RequestInit).headers as Record<
        string,
        string
      >
    )['X-Goog-API-Key'];
    expect(translationKey).toBe('discovered-key');
  });

  it('fails the chapter only when every chunk fails', async () => {
    mockFetchTimeout.mockResolvedValue(
      response([['Hello']], { ok: false, status: 500 }),
    );
    await expect(
      translateViaGooglePa(['Hola'], {
        apiKeys: ['k1'],
        cachedKey: 'cached-key',
        keyLastChecked: Date.now(),
        sourceLanguage: 'es',
        targetLanguage: 'en',
      }),
    ).rejects.toThrow(/Google PA/);
  });
});
