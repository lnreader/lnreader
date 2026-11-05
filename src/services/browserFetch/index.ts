import { getClearance } from './cookies';
import {
  BrowserFetchUnavailableError,
  BrowserFetchUnsupportedBodyError,
  CloudflareBlockedError,
  CloudflareInteractiveError,
} from './errors';
import type {
  BrowserFetchResult,
  BrowserFetchTransport,
  BrowserSolveOutcome,
  BrowserSolveRequest,
} from './types';

export {
  BrowserFetchUnavailableError,
  BrowserFetchUnsupportedBodyError,
  CloudflareBlockedError,
  CloudflareInteractiveError,
} from './errors';

export const BROWSER_SOLVE_TIMEOUT_MS = 30_000;
export const BROWSER_FETCH_TIMEOUT_MS = 20_000;
export const BROWSER_FETCH_MAX_RESPONSE_LENGTH = 10 * 1024 * 1024;

const CLOUDFLARE_MARKERS = [
  'Attention Required! | Cloudflare',
  'Just a moment...',
  'cf-error-details',
  'Checking your browser before accessing',
  'Enable JavaScript and cookies to continue',
];
const CLOUDFLARE_STATUSES = new Set([403, 503]);

const UNSAFE_HEADERS = new Set([
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'host',
  'keep-alive',
  'origin',
  'set-cookie',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

let transport: BrowserFetchTransport | undefined;

export const setBrowserFetchTransport = (next: BrowserFetchTransport) => {
  transport = next;

  return () => {
    if (transport === next) {
      transport = undefined;
    }
  };
};

export const containsCloudflareMarkers = (body: string) => {
  const normalized = body.toLowerCase();
  return CLOUDFLARE_MARKERS.some(marker =>
    normalized.includes(marker.toLowerCase()),
  );
};

const getHeader = (headers: Record<string, string>, name: string) => {
  const key = Object.keys(headers).find(
    header => header.toLowerCase() === name.toLowerCase(),
  );
  return key ? headers[key] : undefined;
};

export const isCloudflareResponse = async (response: Response) => {
  if (response.headers.get('cf-mitigated')?.toLowerCase() === 'challenge') {
    return true;
  }

  if (!CLOUDFLARE_STATUSES.has(response.status)) {
    return false;
  }

  const server = response.headers.get('server')?.toLowerCase() ?? '';
  if (!server.includes('cloudflare')) {
    return false;
  }

  try {
    return containsCloudflareMarkers(await response.clone().text());
  } catch {
    return false;
  }
};

const isCloudflareResult = (result: BrowserFetchResult) => {
  if (
    getHeader(result.headers, 'cf-mitigated')?.toLowerCase() === 'challenge'
  ) {
    return true;
  }

  // No server-header check: the WebView does not expose response headers for
  // page navigations, so the body markers are the only signal.
  return (
    CLOUDFLARE_STATUSES.has(result.status) &&
    containsCloudflareMarkers(result.body)
  );
};

const headersToRecord = (headers?: RequestInit['headers']) => {
  const record: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    record[key] = value;
  });
  return record;
};

const toWebViewHeaders = (headers: Record<string, string>) => {
  const result: Record<string, string> = {};
  Object.entries(headers).forEach(([name, value]) => {
    const normalized = name.toLowerCase();
    if (UNSAFE_HEADERS.has(normalized) || normalized.startsWith('proxy-')) {
      return;
    }
    result[name] = value;
  });
  return result;
};

const normalizeBody = (body?: RequestInit['body']) => {
  if (body === undefined || body === null) {
    return { body: undefined, unsupported: false };
  }

  if (typeof body === 'string') {
    return { body, unsupported: false };
  }

  if (body instanceof URLSearchParams) {
    return { body: body.toString(), unsupported: false };
  }

  return { body: undefined, unsupported: true };
};

const resolveSolveUrl = (url: string, method: string) => {
  if (method === 'GET') {
    return url;
  }

  try {
    return new URL(url).origin + '/';
  } catch {
    return url;
  }
};

const getHost = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const hostQueues = new Map<string, Promise<void>>();

const withHostLock = <T>(host: string, task: () => Promise<T>): Promise<T> => {
  const previous = hostQueues.get(host) ?? Promise.resolve();
  const result = previous.then(task, task);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  hostQueues.set(host, tail);
  void tail.finally(() => {
    if (hostQueues.get(host) === tail) {
      hostQueues.delete(host);
    }
  });
  return result;
};

const prepareSolveRequest = (
  url: string,
  init: RequestInit | undefined,
): BrowserSolveRequest => {
  const headers = headersToRecord(init?.headers);
  const method = (init?.method || 'GET').toUpperCase();
  const body = normalizeBody(init?.body);

  return {
    url: resolveSolveUrl(url, method),
    request: {
      url,
      method,
      headers,
      body: body.body,
      timeoutMs: BROWSER_FETCH_TIMEOUT_MS,
      maxResponseLength: BROWSER_FETCH_MAX_RESPONSE_LENGTH,
    },
    navigationHeaders: toWebViewHeaders(headers),
    userAgent: getHeader(headers, 'user-agent') ?? '',
    timeoutMs: BROWSER_SOLVE_TIMEOUT_MS,
    hasUnsupportedBody: body.unsupported,
  };
};

const browserResponses = new WeakSet<Response>();

// The body of a browser response is text the WebView already decoded with the
// page's charset, so callers must not decode it again with another encoding.
export const isBrowserResponse = (response: Response) =>
  browserResponses.has(response);

const toResponse = (result: BrowserFetchResult) => {
  const headers = new Headers();
  Object.entries(result.headers).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // A string body, not bytes: React Native's whatwg-fetch decodes ArrayBuffer
  // bodies as Latin-1 in text() and cannot build a Blob from them.
  const response = new Response(result.body || null, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });

  if (result.url) {
    Object.defineProperty(response, 'url', { value: result.url });
  }

  browserResponses.add(response);
  return response;
};

export const browserFetch = async (
  url: string,
  init?: RequestInit,
): Promise<Response> => {
  const currentTransport = transport;
  if (!currentTransport) {
    throw new BrowserFetchUnavailableError();
  }

  const request = prepareSolveRequest(url, init);
  const observedClearance = await getClearance(url);

  return withHostLock(getHost(url), async () => {
    let clearance = await getClearance(url);

    if (!clearance || clearance === observedClearance) {
      // Android's cookie manager hides the cookie's Domain, so a stale
      // clearance cannot be reliably deleted; the solve must replace it.
      const staleClearance = clearance;

      let outcome: BrowserSolveOutcome;
      try {
        outcome = await currentTransport.solve({ ...request, staleClearance });
      } catch (error) {
        if (
          error instanceof CloudflareInteractiveError ||
          error instanceof BrowserFetchUnsupportedBodyError
        ) {
          throw error;
        }
        throw new CloudflareBlockedError(url);
      }

      if (outcome.type === 'response') {
        if (isCloudflareResult(outcome.result)) {
          throw new CloudflareBlockedError(url);
        }
        return toResponse(outcome.result);
      }

      clearance = await getClearance(url);
      if (!clearance || clearance === staleClearance) {
        throw new CloudflareBlockedError(url);
      }
    }

    const response = await fetch(url, init);
    if (!(await isCloudflareResponse(response))) {
      return response;
    }

    throw new CloudflareBlockedError(url);
  });
};
