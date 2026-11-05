import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { getClearance } from './cookies';
import {
  BrowserFetchUnsupportedBodyError,
  CloudflareInteractiveError,
} from './errors';
import { setBrowserFetchTransport } from './index';
import {
  BROWSER_FETCH_MESSAGE_TYPE,
  buildBrowserFetchScript,
  buildDocumentResponseScript,
  CLOUDFLARE_LISTENER_SCRIPT,
  CLOUDFLARE_MESSAGE_TYPE,
} from './script';
import type {
  BrowserFetchResult,
  BrowserSolveOutcome,
  BrowserSolveRequest,
} from './types';

const CLEARANCE_POLL_INTERVAL_MS = 500;
const FALLBACK_DELAY_MS = 500;

type PendingSolve = {
  request: BrowserSolveRequest;
  resolve: (outcome: BrowserSolveOutcome) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  poll: ReturnType<typeof setInterval>;
  fallbackTimeout?: ReturnType<typeof setTimeout>;
  requestId?: string;
  challengeFound: boolean;
  pageLoaded: boolean;
  httpStatus: number;
  httpStatusText: string;
};

type WebViewConfig = {
  key: number;
  url: string;
  headers: Record<string, string>;
  userAgent: string;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

const hasFreshClearance = async (request: BrowserSolveRequest) => {
  const clearance = await getClearance(request.request.url);
  return !!clearance && clearance !== request.staleClearance;
};

const BrowserFetchProvider = ({ children }: PropsWithChildren) => {
  const webViewRef = useRef<WebView<object> | null>(null);
  const pendingSolveRef = useRef<PendingSolve | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const configCounterRef = useRef(0);
  const requestCounterRef = useRef(0);

  const [config, setConfig] = useState<WebViewConfig | undefined>(undefined);

  const finishSolve = useCallback((outcome: BrowserSolveOutcome) => {
    const pending = pendingSolveRef.current;
    if (!pending) {
      return;
    }

    pendingSolveRef.current = undefined;
    clearTimeout(pending.timeout);
    clearInterval(pending.poll);
    if (pending.fallbackTimeout) {
      clearTimeout(pending.fallbackTimeout);
    }
    setConfig(undefined);
    pending.resolve(outcome);
  }, []);

  const failSolve = useCallback((error: Error) => {
    const pending = pendingSolveRef.current;
    if (!pending) {
      return;
    }

    pendingSolveRef.current = undefined;
    clearTimeout(pending.timeout);
    clearInterval(pending.poll);
    if (pending.fallbackTimeout) {
      clearTimeout(pending.fallbackTimeout);
    }
    setConfig(undefined);
    pending.reject(error);
  }, []);

  const checkClearance = useCallback(
    async (pending: PendingSolve) => {
      if (pendingSolveRef.current !== pending) {
        return;
      }

      const solved = await hasFreshClearance(pending.request);
      if (solved && pendingSolveRef.current === pending) {
        finishSolve({ type: 'clearance' });
      }
    },
    [finishSolve],
  );

  const runFallback = useCallback(
    async (pending: PendingSolve) => {
      if (
        pendingSolveRef.current !== pending ||
        pending.challengeFound ||
        !pending.pageLoaded
      ) {
        return;
      }

      const solved = await hasFreshClearance(pending.request);
      if (pendingSolveRef.current !== pending) {
        return;
      }
      if (solved) {
        finishSolve({ type: 'clearance' });
        return;
      }

      if (pending.request.hasUnsupportedBody) {
        failSolve(new BrowserFetchUnsupportedBodyError());
        return;
      }

      const webView = webViewRef.current;
      if (!webView) {
        failSolve(new Error('The hidden browser is unavailable.'));
        return;
      }

      requestCounterRef.current += 1;
      const requestId = `browser-fetch-${Date.now()}-${
        requestCounterRef.current
      }`;
      pending.requestId = requestId;

      try {
        webView.injectJavaScript(
          pending.request.request.method === 'GET'
            ? buildDocumentResponseScript(
                requestId,
                pending.httpStatus,
                pending.httpStatusText,
                pending.request.request.maxResponseLength,
              )
            : buildBrowserFetchScript(requestId, pending.request.request),
        );
      } catch (error) {
        failSolve(toError(error));
      }
    },
    [failSolve, finishSolve],
  );

  const scheduleFallback = useCallback(
    (pending: PendingSolve) => {
      if (pending.fallbackTimeout || pending.challengeFound) {
        return;
      }

      pending.fallbackTimeout = setTimeout(() => {
        pending.fallbackTimeout = undefined;
        void runFallback(pending);
      }, FALLBACK_DELAY_MS);
    },
    [runFallback],
  );

  const performSolve = useCallback(
    (request: BrowserSolveRequest) => {
      return new Promise<BrowserSolveOutcome>((resolve, reject) => {
        if (pendingSolveRef.current) {
          reject(new Error('A Cloudflare check is already running.'));
          return;
        }

        const pending: PendingSolve = {
          request,
          resolve,
          reject,
          timeout: undefined as unknown as ReturnType<typeof setTimeout>,
          poll: undefined as unknown as ReturnType<typeof setInterval>,
          challengeFound: false,
          pageLoaded: false,
          httpStatus: 200,
          httpStatusText: 'OK',
        };

        pending.timeout = setTimeout(() => {
          failSolve(
            new Error(
              'The Cloudflare check timed out. Open the source in the in-app WebView and try again.',
            ),
          );
        }, request.timeoutMs);
        pending.poll = setInterval(() => {
          void checkClearance(pending);
        }, CLEARANCE_POLL_INTERVAL_MS);

        pendingSolveRef.current = pending;
        configCounterRef.current += 1;
        setConfig({
          key: configCounterRef.current,
          url: request.url,
          headers: request.navigationHeaders,
          userAgent: request.userAgent || getUserAgent(),
        });
        void checkClearance(pending);
      });
    },
    [checkClearance, failSolve],
  );

  const solve = useCallback(
    (request: BrowserSolveRequest) => {
      const result = queueRef.current.then(() => performSolve(request));
      queueRef.current = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    [performSolve],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: {
        type?: string;
        event?: string;
        requestId?: string;
        status?: number;
        statusText?: string;
        url?: string;
        headers?: Record<string, string>;
        body?: string;
        error?: string;
      };

      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      const pending = pendingSolveRef.current;
      if (!pending) {
        return;
      }

      if (message.type === CLOUDFLARE_MESSAGE_TYPE) {
        if (message.event === 'interactiveBegin' || message.event === 'fail') {
          failSolve(
            new CloudflareInteractiveError(pending.request.request.url),
          );
          return;
        }

        if (message.event === 'challengeDetected') {
          pending.challengeFound = true;
          pending.requestId = undefined;
          if (pending.fallbackTimeout) {
            clearTimeout(pending.fallbackTimeout);
            pending.fallbackTimeout = undefined;
          }
        }
        return;
      }

      if (
        message.type !== BROWSER_FETCH_MESSAGE_TYPE ||
        message.requestId !== pending.requestId
      ) {
        return;
      }

      pending.requestId = undefined;

      if (message.error) {
        failSolve(new Error(message.error));
        return;
      }

      if (
        typeof message.status !== 'number' ||
        typeof message.body !== 'string'
      ) {
        failSolve(new Error('The browser returned an invalid response.'));
        return;
      }

      const result: BrowserFetchResult = {
        status: message.status,
        statusText: message.statusText || '',
        url: message.url || '',
        headers: message.headers || {},
        body: message.body,
      };
      finishSolve({ type: 'response', result });
    },
    [failSolve, finishSolve],
  );

  const handleLoadStart = useCallback((_event: WebViewNavigationEvent) => {
    const pending = pendingSolveRef.current;
    if (!pending) {
      return;
    }

    pending.pageLoaded = false;
    pending.challengeFound = false;
    pending.requestId = undefined;
    pending.httpStatus = 200;
    pending.httpStatusText = 'OK';
    if (pending.fallbackTimeout) {
      clearTimeout(pending.fallbackTimeout);
      pending.fallbackTimeout = undefined;
    }
  }, []);

  const handleLoadEnd = useCallback(
    (event: WebViewNavigationEvent | WebViewErrorEvent) => {
      const pending = pendingSolveRef.current;
      if (!pending) {
        return;
      }

      pending.pageLoaded = true;
      void checkClearance(pending);
      scheduleFallback(pending);
    },
    [checkClearance, scheduleFallback],
  );

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    const pending = pendingSolveRef.current;
    if (!pending) {
      return;
    }

    // A 403/503 alone is not a challenge (block pages such as error 1020 use
    // it too); the injected listener reports real challenges.
    pending.httpStatus = event.nativeEvent.statusCode;
    pending.httpStatusText = event.nativeEvent.description || 'Error';
  }, []);

  const handleLoadError = useCallback(
    (event: WebViewErrorEvent) => {
      failSolve(
        toError(
          event.nativeEvent.description ||
            'The in-app browser failed to load the page.',
        ),
      );
    },
    [failSolve],
  );

  const handleRenderProcessGone = useCallback(() => {
    failSolve(
      new Error(
        'The in-app browser crashed while checking Cloudflare. Try again.',
      ),
    );
    setConfig(undefined);
  }, [failSolve]);

  useEffect(() => setBrowserFetchTransport({ solve }), [solve]);

  useEffect(
    () => () => {
      const pending = pendingSolveRef.current;
      if (pending) {
        pendingSolveRef.current = undefined;
        clearTimeout(pending.timeout);
        clearInterval(pending.poll);
        if (pending.fallbackTimeout) {
          clearTimeout(pending.fallbackTimeout);
        }
        pending.reject(new Error('The in-app browser was closed.'));
      }
    },
    [],
  );

  return (
    <>
      {children}
      {config ? (
        <WebView<object>
          key={config.key}
          ref={webViewRef}
          source={{ uri: config.url, headers: config.headers }}
          userAgent={config.userAgent}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          cacheEnabled={true}
          incognito={false}
          setSupportMultipleWindows={false}
          injectedJavaScriptBeforeContentLoaded={CLOUDFLARE_LISTENER_SCRIPT}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onHttpError={handleHttpError}
          onMessage={handleMessage}
          onError={handleLoadError}
          onRenderProcessGone={handleRenderProcessGone}
          onContentProcessDidTerminate={handleRenderProcessGone}
          containerStyle={styles.hiddenWebView}
          pointerEvents="none"
          focusable={false}
          accessible={false}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </>
  );
};

export default BrowserFetchProvider;

const styles = StyleSheet.create({
  hiddenWebView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
