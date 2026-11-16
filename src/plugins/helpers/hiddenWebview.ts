export interface HiddenWebviewFetchOptions {
  waitForSelector?: string;
  timeoutMs?: number;
  settleMs?: number;
  userAgent?: string;
}

export interface HiddenWebviewResponse {
  ok: boolean;
  url: string;
  html: string;
  title: string;
}

export interface HiddenWebviewRequest {
  id: number;
  url: string;
  allowedOrigin: string;
  waitForSelector?: string;
  timeoutMs: number;
  settleMs: number;
  userAgent?: string;
  resolve: (res: HiddenWebviewResponse) => void;
  reject: (err: Error) => void;
}

type Listener = (req: HiddenWebviewRequest | null) => void;

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_SETTLE_MS = 300;

let nextId = 1;
let activeRequest: HiddenWebviewRequest | null = null;
const queue: HiddenWebviewRequest[] = [];
const listeners = new Set<Listener>();
const requestTimers = new Map<number, ReturnType<typeof setTimeout>>();

const clearRequestTimer = (id: number) => {
  const timer = requestTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    requestTimers.delete(id);
  }
};

const startRequestTimer = (id: number, timeoutMs: number) => {
  clearRequestTimer(id);
  requestTimers.set(
    id,
    setTimeout(() => failTimedOutRequest(id), timeoutMs),
  );
};

const notify = () => {
  listeners.forEach(listener => listener(activeRequest));
};

const pump = (): boolean => {
  if (activeRequest || queue.length === 0 || listeners.size === 0) {
    return false;
  }
  activeRequest = queue.shift() || null;
  if (activeRequest) {
    // Reset timer on activation so queued requests get their full timeoutMs budget
    startRequestTimer(activeRequest.id, activeRequest.timeoutMs);
  }
  notify();
  return activeRequest !== null;
};

const settleRequest = (
  req: HiddenWebviewRequest,
  settle: (r: HiddenWebviewRequest) => void,
) => {
  clearRequestTimer(req.id);
  settle(req);
};

export const subscribeHiddenWebview = (listener: Listener): (() => void) => {
  listeners.add(listener);
  if (!pump()) {
    listener(activeRequest);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && activeRequest) {
      settleActiveRequest(activeRequest.id, r =>
        r.reject(new Error('fetchViaWebview: HiddenWebViewHost unmounted')),
      );
    }
  };
};

const settleActiveRequest = (
  id: number,
  settle: (req: HiddenWebviewRequest) => void,
) => {
  if (!activeRequest || activeRequest.id !== id) {
    return;
  }
  const req = activeRequest;
  activeRequest = null;
  notify();
  settleRequest(req, settle);
  pump();
};

const failTimedOutRequest = (id: number) => {
  if (activeRequest?.id === id) {
    settleActiveRequest(id, req =>
      req.reject(new Error('fetchViaWebview: timed out waiting for page')),
    );
    return;
  }
  const queuedIndex = queue.findIndex(req => req.id === id);
  if (queuedIndex !== -1) {
    const [req] = queue.splice(queuedIndex, 1);
    settleRequest(req, r =>
      r.reject(
        new Error(
          listeners.size === 0
            ? 'fetchViaWebview: timed out waiting for HiddenWebViewHost'
            : 'fetchViaWebview: timed out waiting for page',
        ),
      ),
    );
  }
};

export const completeHiddenWebviewRequest = (
  id: number,
  result: HiddenWebviewResponse,
) => {
  settleActiveRequest(id, req => req.resolve(result));
};

export const failHiddenWebviewRequest = (id: number, error: Error) => {
  settleActiveRequest(id, req => req.reject(error));
};

export const validateSameOriginUrl = (url: string, site?: string): string => {
  if (!site) {
    throw new Error('fetchViaWebview: plugin site is not configured');
  }
  let targetUrl: URL;
  let siteUrl: URL;
  try {
    targetUrl = new URL(url);
    siteUrl = new URL(site);
  } catch {
    throw new Error('fetchViaWebview: invalid URL');
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    throw new Error('fetchViaWebview: unsupported protocol');
  }

  if (targetUrl.origin !== siteUrl.origin) {
    throw new Error(
      `fetchViaWebview: cross-origin URL (${targetUrl.origin}) is not allowed for ${siteUrl.origin}`,
    );
  }

  return targetUrl.toString();
};

export const fetchViaWebviewForSite = (
  url: string,
  site?: string,
  options?: HiddenWebviewFetchOptions,
): Promise<HiddenWebviewResponse> => {
  const validatedUrl = validateSameOriginUrl(url, site);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<HiddenWebviewResponse>((resolve, reject) => {
    const id = nextId++;
    const req: HiddenWebviewRequest = {
      id,
      url: validatedUrl,
      allowedOrigin: new URL(validatedUrl).origin,
      waitForSelector: options?.waitForSelector,
      timeoutMs,
      settleMs: options?.settleMs ?? DEFAULT_SETTLE_MS,
      userAgent: options?.userAgent,
      resolve,
      reject,
    };
    startRequestTimer(id, timeoutMs);
    queue.push(req);
    pump();
  });
};
