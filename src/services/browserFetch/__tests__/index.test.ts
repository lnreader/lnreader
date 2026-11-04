import CookieManager from '@preeternal/react-native-cookie-manager';

import {
  BROWSER_FETCH_MAX_RESPONSE_LENGTH,
  BROWSER_FETCH_TIMEOUT_MS,
  BROWSER_SOLVE_TIMEOUT_MS,
  browserFetch,
  BrowserFetchUnavailableError,
  CloudflareBlockedError,
  CloudflareInteractiveError,
  isCloudflareResponse,
  setBrowserFetchTransport,
} from '..';
import type { BrowserFetchTransport, BrowserSolveOutcome } from '../types';

const cookieGet = CookieManager.get as jest.Mock;

const clearanceCookie = (value: string) => ({
  cf_clearance: { name: 'cf_clearance', value },
});

const setupCookies = (initial?: string) => {
  let clearance = initial;

  cookieGet.mockImplementation(async () =>
    clearance ? clearanceCookie(clearance) : {},
  );

  return {
    set: (next?: string) => {
      clearance = next;
    },
    get: () => clearance,
  };
};

describe('isCloudflareResponse', () => {
  it('detects the official challenge header', async () => {
    const challenge = new Response('', {
      status: 403,
      headers: { 'cf-mitigated': 'challenge' },
    });

    await expect(isCloudflareResponse(challenge)).resolves.toBe(true);
  });

  it('does not treat other mitigations as a solvable challenge', async () => {
    const managed = new Response('Forbidden', {
      status: 403,
      headers: { 'cf-mitigated': 'managed' },
    });

    await expect(isCloudflareResponse(managed)).resolves.toBe(false);
  });

  it('uses the HTML markers as a fallback for Cloudflare responses', async () => {
    const blocked = new Response(
      '<html><title>Attention Required! | Cloudflare</title></html>',
      { status: 403, headers: { server: 'cloudflare' } },
    );
    const blockedWithoutServer = new Response(
      '<html><title>Attention Required! | Cloudflare</title></html>',
      { status: 403 },
    );
    const ordinary = new Response('Forbidden', {
      status: 403,
      headers: { server: 'cloudflare' },
    });

    await expect(isCloudflareResponse(blocked)).resolves.toBe(true);
    await expect(isCloudflareResponse(blockedWithoutServer)).resolves.toBe(
      false,
    );
    await expect(isCloudflareResponse(ordinary)).resolves.toBe(false);
  });
});

describe('browserFetch', () => {
  const originalFetch = global.fetch;
  const originalResponse = global.Response;
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    global.fetch = originalFetch;
    global.Response = originalResponse;
  });

  it('rejects when the in-app browser is unavailable', async () => {
    await expect(
      browserFetch('https://example.com/novel'),
    ).rejects.toBeInstanceOf(BrowserFetchUnavailableError);
  });

  it('solves the challenge and retries the native request', async () => {
    const cookies = setupCookies();
    const solve = jest.fn(async () => {
      cookies.set('fresh');
      return { type: 'clearance' as const };
    });
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('<h1>ok</h1>', { status: 200 }),
      ) as unknown as typeof fetch;

    const response = await browserFetch('https://example.com/novel', {
      headers: { 'User-Agent': 'LNReader test' },
    });

    await expect(response.text()).resolves.toBe('<h1>ok</h1>');
    expect(solve).toHaveBeenCalledWith({
      url: 'https://example.com/novel',
      request: {
        url: 'https://example.com/novel',
        method: 'GET',
        headers: { 'user-agent': 'LNReader test' },
        body: undefined,
        timeoutMs: BROWSER_FETCH_TIMEOUT_MS,
        maxResponseLength: BROWSER_FETCH_MAX_RESPONSE_LENGTH,
      },
      navigationHeaders: { 'user-agent': 'LNReader test' },
      userAgent: 'LNReader test',
      timeoutMs: BROWSER_SOLVE_TIMEOUT_MS,
      hasUnsupportedBody: false,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/novel',
      expect.objectContaining({
        headers: { 'User-Agent': 'LNReader test' },
      }),
    );
  });

  it('returns an in-page browser response when no clearance is issued', async () => {
    setupCookies();
    const solve = jest.fn(async () => ({
      type: 'response' as const,
      result: {
        status: 200,
        statusText: 'OK',
        url: 'https://example.com/novel',
        headers: { 'content-type': 'text/html' },
        body: '<h1>ok</h1>',
      },
    }));
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest.fn() as unknown as typeof fetch;

    const response = await browserFetch('https://example.com/novel');

    await expect(response.text()).resolves.toBe('<h1>ok</h1>');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps accented and non-Latin characters in in-page browser responses', async () => {
    // Node's Response decodes UTF-8 correctly; React Native's whatwg-fetch
    // polyfill is what runs on device, so the test must use it.
    global.Response = jest.requireActual<{ Response: typeof Response }>(
      'whatwg-fetch',
    ).Response;
    setupCookies();
    const body = '<p>Café, niño, 第一章</p>';
    const solve = jest.fn(async () => ({
      type: 'response' as const,
      result: {
        status: 200,
        statusText: 'OK',
        url: 'https://example.com/novel',
        headers: { 'content-type': 'text/html' },
        body,
      },
    }));
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest.fn() as unknown as typeof fetch;

    const response = await browserFetch('https://example.com/novel');

    await expect(response.text()).resolves.toBe(body);
  });

  it('throws when the in-page browser response is still a challenge', async () => {
    setupCookies();
    const solve = jest.fn(async () => ({
      type: 'response' as const,
      result: {
        status: 403,
        statusText: 'Forbidden',
        url: 'https://example.com/novel',
        headers: { 'cf-mitigated': 'challenge' },
        body: '',
      },
    }));
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(
      browserFetch('https://example.com/novel'),
    ).rejects.toBeInstanceOf(CloudflareBlockedError);
  });

  it('treats a Cloudflare block page from the browser as blocked', async () => {
    setupCookies();
    const solve = jest.fn(async () => ({
      type: 'response' as const,
      result: {
        status: 403,
        statusText: 'Forbidden',
        url: 'https://example.com/novel',
        headers: { 'content-type': 'text/html' },
        body: '<div id="cf-error-details">Sorry, you have been blocked</div>',
      },
    }));
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(
      browserFetch('https://example.com/novel'),
    ).rejects.toBeInstanceOf(CloudflareBlockedError);
  });

  it('re-solves a stale clearance and retries with the fresh one', async () => {
    const cookies = setupCookies('stale');
    const solve = jest.fn(async () => {
      cookies.set('fresh');
      return { type: 'clearance' as const };
    });
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('ok', { status: 200 }),
      ) as unknown as typeof fetch;

    const response = await browserFetch('https://example.com/novel');

    await expect(response.text()).resolves.toBe('ok');
    expect(solve).toHaveBeenCalledWith(
      expect.objectContaining({ staleClearance: 'stale' }),
    );
  });

  it('does not accept the stale clearance as a solved challenge', async () => {
    setupCookies('stale');
    const solve = jest.fn(async () => ({ type: 'clearance' as const }));
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(
      browserFetch('https://example.com/novel'),
    ).rejects.toBeInstanceOf(CloudflareBlockedError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('skips solving when another request refreshed the clearance', async () => {
    cookieGet.mockReset();
    let reads = 0;
    cookieGet.mockImplementation(async () => {
      reads += 1;
      return reads === 1 ? clearanceCookie('stale') : clearanceCookie('fresh');
    });
    const solve = jest.fn();
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('ok', { status: 200 }),
      ) as unknown as typeof fetch;

    await browserFetch('https://skip.example.com/novel');

    expect(solve).not.toHaveBeenCalled();
  });

  it('solves non-GET requests from the site root', async () => {
    const cookies = setupCookies();
    const solve = jest.fn(async () => {
      cookies.set('fresh');
      return { type: 'clearance' as const };
    });
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('ok', { status: 200 }),
      ) as unknown as typeof fetch;
    const init = {
      method: 'POST',
      body: 'a=1',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    };

    await browserFetch('https://example.com/api/chapter/1', init);

    expect(solve).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api/chapter/1',
      init,
    );
  });

  it('throws when the solve completes without a clearance', async () => {
    const cookies = setupCookies();
    const solve = jest.fn(async () => {
      cookies.set(undefined);
      return { type: 'clearance' as const };
    });
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(
      browserFetch('https://example.com/novel'),
    ).rejects.toBeInstanceOf(CloudflareBlockedError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('propagates interactive challenges', async () => {
    setupCookies();
    const solve = jest.fn(async () => {
      throw new CloudflareInteractiveError('https://example.com/novel');
    });
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(
      browserFetch('https://example.com/novel'),
    ).rejects.toBeInstanceOf(CloudflareInteractiveError);
  });

  it('shares one solve across concurrent requests to the same host', async () => {
    const cookies = setupCookies();
    let releaseSolve: (() => void) | undefined;
    const solve = jest.fn(
      () =>
        new Promise<BrowserSolveOutcome>(resolve => {
          releaseSolve = () => {
            cookies.set('fresh');
            resolve({ type: 'clearance' });
          };
        }),
    );
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('ok', { status: 200 }),
      ) as unknown as typeof fetch;

    const first = browserFetch('https://example.com/novel/1');
    const second = browserFetch('https://example.com/novel/2');

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(solve).toHaveBeenCalledTimes(1);

    releaseSolve?.();
    await Promise.all([first, second]);

    expect(solve).toHaveBeenCalledTimes(1);
  });
});
