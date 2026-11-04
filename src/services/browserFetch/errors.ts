export class BrowserFetchUnavailableError extends Error {
  constructor() {
    super(
      'The in-app browser is not available to bypass this Cloudflare check. Open LNReader and try again.',
    );
    this.name = 'BrowserFetchUnavailableError';
  }
}

export class CloudflareBlockedError extends Error {
  readonly url: string;

  constructor(url: string, message?: string) {
    super(
      message ??
        `Cloudflare blocked the request to ${url}. Open the source in the in-app WebView, complete the check, then try again.`,
    );
    this.name = 'CloudflareBlockedError';
    this.url = url;
  }
}

export class CloudflareInteractiveError extends CloudflareBlockedError {
  constructor(url: string) {
    super(
      url,
      `Cloudflare requires an interactive check for ${url}. Open the source in the in-app WebView, complete the check, then try again.`,
    );
    this.name = 'CloudflareInteractiveError';
  }
}

export class BrowserFetchUnsupportedBodyError extends Error {
  constructor() {
    super(
      'The in-app browser can only replay text and URL-encoded request bodies.',
    );
    this.name = 'BrowserFetchUnsupportedBodyError';
  }
}
