export type BrowserFetchRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxResponseLength: number;
};

export type BrowserFetchResult = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  url: string;
};

export type BrowserSolveOutcome =
  | { type: 'clearance' }
  | { type: 'response'; result: BrowserFetchResult };

export type BrowserSolveRequest = {
  url: string;
  request: BrowserFetchRequest;
  navigationHeaders: Record<string, string>;
  userAgent: string;
  timeoutMs: number;
  hasUnsupportedBody: boolean;
  staleClearance?: string;
};

export type BrowserFetchTransport = {
  solve: (request: BrowserSolveRequest) => Promise<BrowserSolveOutcome>;
};
