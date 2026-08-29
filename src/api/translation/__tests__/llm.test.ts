import {
  buildNumberedPayload,
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
  url: 'https://example.com/chat',
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

describe('llm numbered payload', () => {
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

  it('rejects when no API key is configured', async () => {
    await expect(
      translateChatTexts(makeRequest(), ['a'], undefined, {
        apiKey: '',
        errorCode: 'GEMINI',
      }),
    ).rejects.toBeInstanceOf(TranslationError);
    expect(mockFetchTimeout).not.toHaveBeenCalled();
  });

  it('splits long chapters into batches of at most 20 items', async () => {
    mockFetchTimeout.mockResolvedValue(echoResponse() as never);
    const texts = Array.from({ length: 45 }, (_, i) => `t${i}`);
    const results = await translateChatTexts(makeRequest(), texts, undefined, {
      apiKey: 'key',
      errorCode: 'GEMINI',
    });
    expect(mockFetchTimeout).toHaveBeenCalledTimes(3);
    expect(results).toEqual(texts.map(text => `${text} translated`));
  });

  it('falls back to the original text per batch instead of aborting', async () => {
    mockFetchTimeout
      .mockRejectedValueOnce(
        new TranslationError(
          'OPENAI',
          'Provider returned HTTP 400: bad',
        ) as never,
      )
      .mockResolvedValue(echoResponse() as never);
    const texts = Array.from({ length: 25 }, (_, i) => `t${i}`);
    const results = await translateChatTexts(makeRequest(), texts, undefined, {
      apiKey: 'key',
      errorCode: 'GEMINI',
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
        apiKey: 'key',
        errorCode: 'GEMINI',
      }),
    ).rejects.toBeInstanceOf(TranslationError);
  });

  it('retries rate-limited requests with backoff', async () => {
    jest.useFakeTimers();
    mockFetchTimeout
      .mockResolvedValueOnce(echoResponse(429) as never)
      .mockResolvedValueOnce(echoResponse() as never);
    const p = translateChatTexts(makeRequest(), ['a'], undefined, {
      apiKey: 'key',
      errorCode: 'GEMINI',
    });
    await jest.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toEqual(['a translated']);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
