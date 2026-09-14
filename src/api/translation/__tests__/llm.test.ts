import {
  buildNumberedPayload,
  CONTENT_BLOCKED,
  parseApiKeys,
  parseNumberedTranslations,
  translateChatTexts,
  type ChatModelRequest,
} from '@api/translation/llm';
import { TranslationError } from '@api/translation/types';
import { fetchTimeout } from '@utils/fetch/fetch';

jest.mock('@utils/fetch/fetch', () => ({ fetchTimeout: jest.fn() }));

const mockFetchTimeout = fetchTimeout as jest.MockedFunction<
  typeof fetchTimeout
>;

const makeRequest = (): ChatModelRequest => ({
  buildUrl: () => 'https://example.com/chat',
  buildHeaders: () => ({ Authorization: 'Bearer test' }),
  buildBody: (payload: string) => ({ payload }),
  reply: {
    parseText: data =>
      (data as { replies: string[] } | null)?.replies.join('\n'),
  },
});

const echoResponse = (status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    const body = mockFetchTimeout.mock.calls.at(-1)![1];
    const parsed = JSON.parse(body.body as string);
    const payload = parsed.payload as string;
    return { replies: payload.split('\n').map(line => `${line} translated`) };
  },
  text: async () => 'echo body',
});

describe('llm key lists and numbered payload', () => {
  it('parses NoveLA key lists (newline, comma, semicolon)', () => {
    expect(parseApiKeys('aaa\nbbb,ccc;ddd')).toEqual([
      'aaa',
      'bbb',
      'ccc',
      'ddd',
    ]);
    expect(parseApiKeys('  aaa  ,  bbb  ')).toEqual(['aaa', 'bbb']);
    expect(parseApiKeys('')).toEqual([]);
  });

  it('builds a sequential numbered list', () => {
    expect(buildNumberedPayload(['a', 'b', 'c'])).toBe('1. a\n2. b\n3. c');
  });

  it('parses numbered replies back onto input positions', () => {
    const reply = [
      '*Generated translation:*',
      '```',
      '1. Alpha-1',
      '2. Alpha-2',
      '',
      '**3.** Alpha-3',
      '№4. Alpha-4',
      '5) Alpha-5',
      'continuation line',
      '```',
    ].join('\n');
    expect(parseNumberedTranslations(reply, ['a', 'b', 'c', 'd', 'e'])).toEqual(
      [
        'Alpha-1',
        'Alpha-2',
        'Alpha-3',
        'Alpha-4',
        'Alpha-5\ncontinuation line',
      ],
    );
  });

  it('keeps original text for missing or malformed items', () => {
    const reply = ['1. only-first', '9. out-of-range'].join('\n');
    expect(parseNumberedTranslations(reply, ['a', 'b', 'c'])).toEqual([
      'only-first',
      'b',
      'c',
    ]);
  });
});

describe('translateChatTexts', () => {
  beforeEach(() => {
    mockFetchTimeout.mockReset();
  });

  it('rejects when no API keys are configured', async () => {
    await expect(
      translateChatTexts(makeRequest(), ['a'], undefined, {
        apiKeys: [],
        errorCode: 'GEMINI',
      }),
    ).rejects.toBeInstanceOf(TranslationError);
    expect(mockFetchTimeout).not.toHaveBeenCalled();
  });

  it('splits chapters into batches of the configured size (default 60)', async () => {
    mockFetchTimeout.mockResolvedValue(echoResponse() as never);
    const texts = Array.from({ length: 45 }, (_, i) => `t${i}`);
    const results = await translateChatTexts(makeRequest(), texts, undefined, {
      apiKeys: ['key'],
      errorCode: 'GEMINI',
    });
    // 45 ≤ default 60 → a single request.
    expect(mockFetchTimeout).toHaveBeenCalledTimes(1);

    mockFetchTimeout.mockClear();
    mockFetchTimeout.mockResolvedValue(echoResponse() as never);
    await translateChatTexts(makeRequest(), texts, undefined, {
      apiKeys: ['key'],
      errorCode: 'GEMINI',
      batchSize: 20,
    });
    expect(mockFetchTimeout).toHaveBeenCalledTimes(3);
    expect(results).toEqual(texts.map(text => `${text} translated`));
  });

  it('rotates to the next key on 429', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(echoResponse(429) as never)
      .mockResolvedValueOnce(echoResponse() as never);
    const results = await translateChatTexts(makeRequest(), ['a'], undefined, {
      apiKeys: ['dead', 'live'],
      errorCode: 'GEMINI',
    });
    expect(results).toEqual(['a translated']);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(2);
  });

  it('rotates past invalid keys on 401 and 403', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(echoResponse(401) as never)
      .mockResolvedValueOnce(echoResponse(403) as never)
      .mockResolvedValueOnce(echoResponse() as never);
    const results = await translateChatTexts(makeRequest(), ['a'], undefined, {
      apiKeys: ['bad1', 'bad2', 'good'],
      errorCode: 'OPENAI',
    });
    expect(results).toEqual(['a translated']);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(3);
  });

  it('retries 5xx on the same key before giving up', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(echoResponse(503) as never)
      .mockResolvedValueOnce(echoResponse(503) as never)
      .mockResolvedValueOnce(echoResponse() as never);
    const results = await translateChatTexts(makeRequest(), ['a'], undefined, {
      apiKeys: ['key'],
      errorCode: 'GEMINI',
    });
    expect(results).toEqual(['a translated']);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(3);
  });

  it('fails a batch when every key is rate-limited', async () => {
    mockFetchTimeout.mockResolvedValue(echoResponse(429) as never);
    await expect(
      translateChatTexts(makeRequest(), ['a', 'b'], undefined, {
        apiKeys: ['key'],
        errorCode: 'GEMINI',
      }),
    ).rejects.toThrow(/Rate limit/);
  });

  it('aborts immediately on a content-filtered reply (NoveLA blocked)', async () => {
    mockFetchTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    } as never);
    const blocked = makeRequest();
    blocked.reply.parseText = () => CONTENT_BLOCKED;
    await expect(
      translateChatTexts(blocked, ['a'], undefined, {
        apiKeys: ['key'],
        errorCode: 'GEMINI',
      }),
    ).rejects.toThrow(/content filter/i);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(1);
  });

  it('falls back to original text per batch instead of aborting', async () => {
    // Three rejections exhaust the same-key retries so the 20-item batch fails.
    mockFetchTimeout
      .mockRejectedValueOnce(
        new TranslationError(
          'OPENAI',
          'Provider returned HTTP 400: bad',
        ) as never,
      )
      .mockRejectedValueOnce(
        new TranslationError(
          'OPENAI',
          'Provider returned HTTP 400: bad',
        ) as never,
      )
      .mockRejectedValueOnce(
        new TranslationError(
          'OPENAI',
          'Provider returned HTTP 400: bad',
        ) as never,
      )
      .mockResolvedValue(echoResponse() as never);
    const texts = Array.from({ length: 25 }, (_, i) => `t${i}`);
    const results = await translateChatTexts(makeRequest(), texts, undefined, {
      apiKeys: ['key'],
      errorCode: 'GEMINI',
      batchSize: 20,
    });
    expect(results.slice(0, 20)).toEqual(texts.slice(0, 20));
    expect(results.slice(20)).toEqual(
      texts.slice(20).map(text => `${text} translated`),
    );
  });

  it('aborts the chapter only when every batch fails', async () => {
    mockFetchTimeout.mockRejectedValue(
      new TranslationError(
        'OPENAI',
        'Provider returned HTTP 400: bad',
      ) as never,
    );
    await expect(
      translateChatTexts(makeRequest(), ['a', 'b'], undefined, {
        apiKeys: ['key'],
        errorCode: 'GEMINI',
      }),
    ).rejects.toBeInstanceOf(TranslationError);
  });
});
