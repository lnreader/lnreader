import { PluginError } from '@plugins/types';

export { PluginError };

export type PluginErrorCode = `${PluginError}`;

export type PluginErrorOptions = {
  status?: number;
  message?: string;
  url?: string;
};

export type PluginErrorInstance = Error & {
  code: PluginErrorCode;
  status?: number;
  url?: string;
};

export type CheckResponseOptions = {
  search?: boolean;
  notFoundCode?: PluginErrorCode;
  message?: string;
};

const PLUGIN_ERROR_CODES: readonly string[] = Object.keys(PluginError).map(
  key => PluginError[key as keyof typeof PluginError],
);

const STATUS_TO_CODE: Record<number, PluginErrorCode> = {
  401: PluginError.AuthRequired,
  403: PluginError.Cloudflare,
  404: PluginError.NotFound,
  429: PluginError.RateLimited,
  503: PluginError.Cloudflare,
};

const CHALLENGE_TITLES = [
  'bot verification',
  'you are being redirected...',
  'un instant...',
  'one moment...',
  'just a moment...',
  'redirecting...',
  'attention required! | cloudflare',
];

function getHostnameBase(url: string): string {
  const match = url.match(/^https?:\/\/([^/?#]+)/i);
  const host = (match ? match[1] : '').toLowerCase().replace(/^www\./, '');
  if (!host) {
    return '';
  }
  const parts = host.split('.');
  if (parts.length > 1) {
    parts.pop();
  }
  return parts.join('.');
}

export function createPluginError(
  code: PluginErrorCode,
  options?: PluginErrorOptions,
): PluginErrorInstance {
  const message = options?.message || code;
  const error = new Error(message) as PluginErrorInstance;
  error.name = 'PluginError';
  error.code = code;
  if (options?.status !== undefined) {
    error.status = options.status;
  }
  if (options?.url) {
    error.url = options.url;
  }
  return error;
}

export function httpError(
  status: number,
  message?: string,
  url?: string,
): PluginErrorInstance {
  const code = STATUS_TO_CODE[status] ?? PluginError.NetworkError;
  const fallbackMessage =
    code === PluginError.NetworkError && status
      ? `Could not reach site (${status}), please try to open in webview.`
      : code;
  return createPluginError(code, {
    status,
    message: message || fallbackMessage,
    url,
  });
}

export function checkResponse(
  response: Response,
  options?: CheckResponseOptions,
): Response {
  if (response.ok || options?.search) {
    return response;
  }
  if (response.status === 404 && options?.notFoundCode) {
    throw createPluginError(options.notFoundCode, {
      status: response.status,
      message: options.message,
      url: response.url || undefined,
    });
  }
  throw httpError(response.status, options?.message, response.url || undefined);
}

export function isChallengeHtml(
  html: string,
  requestUrl?: string,
  responseUrl?: string,
): boolean {
  if (requestUrl && responseUrl) {
    const reqHost = getHostnameBase(requestUrl);
    const resHost = getHostnameBase(responseUrl);
    if (reqHost && resHost && reqHost !== resHost) {
      return true;
    }
  }
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().toLowerCase() : '';
  if (!title) {
    return false;
  }
  return (
    CHALLENGE_TITLES.indexOf(title) !== -1 || /\bcloudflare\b/i.test(title)
  );
}

export function assertNoChallenge(
  html: string,
  requestUrl?: string,
  responseUrl?: string,
  message?: string,
): void {
  if (isChallengeHtml(html, requestUrl, responseUrl)) {
    throw createPluginError(PluginError.Captcha, {
      status: 403,
      message,
      url: responseUrl || requestUrl,
    });
  }
}

export function isPluginError(error: unknown): error is PluginErrorInstance {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as Partial<PluginErrorInstance>).code;
  return typeof code === 'string' && PLUGIN_ERROR_CODES.indexOf(code) !== -1;
}
