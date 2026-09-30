import NativeCloudflare from '@modules/native-cloudflare';

jest.mock('@modules/native-cloudflare', () => ({
  __esModule: true,
  default: { solveChallenge: jest.fn() },
}));

jest.mock('@hooks/persisted/useUserAgent', () => ({
  getUserAgent: () => 'LNReader test',
}));

const solveChallenge = NativeCloudflare!.solveChallenge as jest.Mock;
const fetchMock = jest.fn();

const response = (status: number, headers: Record<string, string> = {}) =>
  ({ status, ok: status < 400, headers: new Headers(headers) } as Response);

const challenge = () =>
  response(403, { 'cf-mitigated': 'challenge', 'server': 'cloudflare' });

const textResponse = (text: string) =>
  ({ ...response(200), blob: async () => ({ text }) } as unknown as Response);

// React Native's FileReader needs the native blob module, which Jest lacks.
class TextFileReader {
  result: string | null = null;
  onloadend?: () => void;
  readAsText(blob: { text: string }) {
    this.result = blob.text;
    this.onloadend?.();
  }
}

// The solver keeps per-host state at module level, so each test gets a fresh copy.
const loadFetch = () => {
  let fetchModule!: typeof import('../fetch');
  jest.isolateModules(() => {
    fetchModule = require('../fetch');
  });
  return fetchModule;
};
const loadFetchApi = () => loadFetch().fetchApi;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
});

describe('fetchApi Cloudflare bypass', () => {
  it('returns normal responses without starting a solve', async () => {
    const ok = response(200);
    fetchMock.mockResolvedValue(ok);

    await expect(loadFetchApi()('https://site.test/novel')).resolves.toBe(ok);
    expect(solveChallenge).not.toHaveBeenCalled();
  });

  it('does not treat a plain 403 as a challenge', async () => {
    const forbidden = response(403, { server: 'cloudflare' });
    fetchMock.mockResolvedValue(forbidden);

    await expect(loadFetchApi()('https://site.test/novel')).resolves.toBe(
      forbidden,
    );
    expect(solveChallenge).not.toHaveBeenCalled();
  });

  it('solves the challenge with the request user agent and retries', async () => {
    const ok = response(200);
    fetchMock.mockResolvedValueOnce(challenge()).mockResolvedValueOnce(ok);
    solveChallenge.mockResolvedValue(true);

    const result = await loadFetchApi()('https://site.test/novel', {
      headers: { 'user-agent': 'Plugin UA' },
    });

    expect(result).toBe(ok);
    expect(solveChallenge).toHaveBeenCalledWith(
      'https://site.test/novel',
      'Plugin UA',
      expect.any(Number),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the challenge response when it cannot be solved', async () => {
    const blocked = challenge();
    fetchMock.mockResolvedValue(blocked);
    solveChallenge.mockResolvedValue(false);

    await expect(loadFetchApi()('https://site.test/novel')).resolves.toBe(
      blocked,
    );
    expect(solveChallenge).toHaveBeenCalledWith(
      'https://site.test/novel',
      'LNReader test',
      expect.any(Number),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a solver error as unsolved', async () => {
    const blocked = challenge();
    fetchMock.mockResolvedValue(blocked);
    solveChallenge.mockRejectedValue(new Error('WebView unavailable'));

    await expect(loadFetchApi()('https://site.test/novel')).resolves.toBe(
      blocked,
    );
  });

  it('shares one solve between concurrent requests to the same host', async () => {
    fetchMock.mockImplementation(async () =>
      solveChallenge.mock.calls.length ? response(200) : challenge(),
    );
    let finishSolve!: (solved: boolean) => void;
    solveChallenge.mockReturnValue(
      new Promise<boolean>(resolve => (finishSolve = resolve)),
    );
    const fetchApi = loadFetchApi();

    const requests = Promise.all([
      fetchApi('https://site.test/chapter/1'),
      fetchApi('https://site.test/chapter/2'),
      fetchApi('https://site.test/chapter/3'),
    ]);
    await new Promise(setImmediate);
    finishSolve(true);
    const results = await requests;

    expect(solveChallenge).toHaveBeenCalledTimes(1);
    expect(results.map(r => r.status)).toEqual([200, 200, 200]);
  });

  it('does not retry a failed host until the cooldown passes', async () => {
    jest.useFakeTimers({ now: 0 });
    try {
      fetchMock.mockResolvedValue(challenge());
      solveChallenge.mockResolvedValue(false);
      const fetchApi = loadFetchApi();

      await fetchApi('https://site.test/novel/1');
      await fetchApi('https://site.test/novel/2');
      expect(solveChallenge).toHaveBeenCalledTimes(1);

      await fetchApi('https://other.test/novel');
      expect(solveChallenge).toHaveBeenCalledTimes(2);

      jest.setSystemTime(5 * 60_000);
      await fetchApi('https://site.test/novel/3');
      expect(solveChallenge).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps solves for different user agents on the same host apart', async () => {
    fetchMock.mockResolvedValue(challenge());
    solveChallenge.mockResolvedValue(false);
    const fetchApi = loadFetchApi();

    await fetchApi('https://site.test/novel/1');
    await fetchApi('https://site.test/novel/2', {
      headers: { 'User-Agent': 'Plugin UA' },
    });

    expect(solveChallenge.mock.calls.map(([, userAgent]) => userAgent)).toEqual(
      ['LNReader test', 'Plugin UA'],
    );
  });
});

describe('fetchText Cloudflare bypass', () => {
  const originalFileReader = global.FileReader;
  beforeAll(() => {
    global.FileReader = TextFileReader as unknown as typeof FileReader;
  });
  afterAll(() => {
    global.FileReader = originalFileReader;
  });

  it('returns the page text after solving the challenge', async () => {
    fetchMock
      .mockResolvedValueOnce(challenge())
      .mockResolvedValueOnce(textResponse('<p>chapter</p>'));
    solveChallenge.mockResolvedValue(true);

    await expect(
      loadFetch().fetchText('https://site.test/chapter'),
    ).resolves.toBe('<p>chapter</p>');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an empty string when the challenge cannot be solved', async () => {
    fetchMock.mockResolvedValue(challenge());
    solveChallenge.mockResolvedValue(false);

    await expect(
      loadFetch().fetchText('https://site.test/chapter'),
    ).resolves.toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
