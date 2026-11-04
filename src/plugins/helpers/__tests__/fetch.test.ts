import CookieManager from '@preeternal/react-native-cookie-manager';

import { setBrowserFetchTransport } from '@services/browserFetch';
import type { BrowserFetchTransport } from '@services/browserFetch/types';
import { fetchApi } from '../fetch';

jest.mock('@hooks/persisted/useUserAgent', () => ({
  getUserAgent: () => 'LNReader test',
}));

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
  };
};

describe('fetchApi', () => {
  const originalFetch = global.fetch;
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    global.fetch = originalFetch;
  });

  it('uses the in-app browser when Cloudflare blocks the native request', async () => {
    const cookies = setupCookies();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 403,
          headers: { 'cf-mitigated': 'challenge' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<h1>ok</h1>', { status: 200 }),
      ) as unknown as typeof fetch;
    const solve = jest.fn(async () => {
      cookies.set('fresh');
      return { type: 'clearance' as const };
    });
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);

    const response = await fetchApi('https://example.com/novel');

    await expect(response.text()).resolves.toBe('<h1>ok</h1>');
    expect(solve).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/novel' }),
    );
  });

  it('detects the official challenge header', async () => {
    const cookies = setupCookies();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 503,
          headers: { 'cf-mitigated': 'challenge' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('ok', { status: 200 }),
      ) as unknown as typeof fetch;
    const solve = jest.fn(async () => {
      cookies.set('fresh');
      return { type: 'clearance' as const };
    });
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);

    await fetchApi('https://example.com/novel');

    expect(solve).toHaveBeenCalled();
  });

  it('leaves ordinary responses untouched', async () => {
    const response = new Response('Forbidden', { status: 403 });
    global.fetch = jest
      .fn()
      .mockResolvedValue(response) as unknown as typeof fetch;
    const solve = jest.fn();
    cleanup = setBrowserFetchTransport({
      solve,
    } as unknown as BrowserFetchTransport);

    const result = await fetchApi('https://example.com/novel');

    expect(result).toBe(response);
    expect(solve).not.toHaveBeenCalled();
  });
});
