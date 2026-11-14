import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, {
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { getUserAgent } from '@hooks/persisted/useUserAgent';
import {
  completeHiddenWebviewRequest,
  failHiddenWebviewRequest,
  HiddenWebviewRequest,
  subscribeHiddenWebview,
  validateSameOriginUrl,
} from '@plugins/helpers/hiddenWebview';

const buildExtractorScript = (req: HiddenWebviewRequest): string => {
  const selectorJson = req.waitForSelector
    ? JSON.stringify(req.waitForSelector)
    : 'null';
  const settleMs = Math.max(0, req.settleMs);

  return `
    (function() {
      if (window.__lnrHiddenExtracting) return;
      window.__lnrHiddenExtracting = true;
      var reqId = ${req.id};
      var selector = ${selectorJson};
      var settleMs = ${settleMs};
      var startedAt = Date.now();
      var maxWaitMs = ${Math.max(1000, req.timeoutMs - 500)};

      function sendResult(ok) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'result',
            id: reqId,
            ok: ok,
            url: window.location.href || '',
            title: document.title || '',
            html: document.documentElement ? document.documentElement.outerHTML : ''
          }));
        } catch (err) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            id: reqId,
            message: String(err && err.message ? err.message : err)
          }));
        }
      }

      function checkReady() {
        if (document.readyState !== 'complete') {
          setTimeout(checkReady, 150);
          return;
        }
        if (selector) {
          var matches = document.querySelectorAll(selector);
          var hasContent = Array.prototype.some.call(matches, function(el) {
            return (el.textContent || '').trim().length > 0;
          });
          if (hasContent) {
            setTimeout(function() { sendResult(true); }, settleMs);
            return;
          }
          if (Date.now() - startedAt >= maxWaitMs) {
            sendResult(false);
            return;
          }
          setTimeout(checkReady, 250);
          return;
        }
        setTimeout(function() { sendResult(true); }, settleMs);
      }

      checkReady();
    })();
    true;
  `;
};

const HiddenWebViewHost = () => {
  const [activeRequest, setActiveRequest] =
    useState<HiddenWebviewRequest | null>(null);
  const webViewRef = useRef<WebView<object> | null>(null);
  const topFrameUrlRef = useRef<string | null>(null);
  const defaultUserAgent = useMemo(() => getUserAgent(), []);

  useEffect(() => {
    return subscribeHiddenWebview(req => {
      setActiveRequest(req);
    });
  }, []);

  useEffect(() => {
    topFrameUrlRef.current = activeRequest?.url ?? null;
  }, [activeRequest]);

  const handleLoadEnd = useCallback(() => {
    if (!activeRequest) {
      return;
    }
    webViewRef.current?.injectJavaScript(buildExtractorScript(activeRequest));
  }, [activeRequest]);

  const handleNavigationStateChange = useCallback(
    (nav: WebViewNavigation) => {
      if (!activeRequest) {
        return;
      }
      if (nav.url) {
        topFrameUrlRef.current = nav.url;
      }
      if (nav.loading) {
        return;
      }
      webViewRef.current?.injectJavaScript(buildExtractorScript(activeRequest));
    },
    [activeRequest],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!activeRequest) {
        return;
      }
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload?.id !== activeRequest.id) {
          return;
        }
        if (payload.type === 'result') {
          const finalUrl = validateSameOriginUrl(
            String(payload.url || activeRequest.url),
            activeRequest.allowedOrigin,
          );
          completeHiddenWebviewRequest(activeRequest.id, {
            ok: Boolean(payload.ok),
            url: finalUrl,
            html: String(payload.html || ''),
            title: String(payload.title || ''),
          });
        } else if (payload.type === 'error') {
          failHiddenWebviewRequest(
            activeRequest.id,
            new Error(payload.message || 'fetchViaWebview: extraction failed'),
          );
        }
      } catch (err) {
        failHiddenWebviewRequest(
          activeRequest.id,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    },
    [activeRequest],
  );

  const handleError = useCallback(
    (event: WebViewErrorEvent) => {
      if (!activeRequest) {
        return;
      }
      failHiddenWebviewRequest(
        activeRequest.id,
        new Error(
          event.nativeEvent.description || 'fetchViaWebview: WebView error',
        ),
      );
    },
    [activeRequest],
  );

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      if (!activeRequest || activeRequest.waitForSelector) {
        return;
      }
      const { statusCode, url, description } = event.nativeEvent;
      if (statusCode < 400) {
        return;
      }
      const currentTopUrl = topFrameUrlRef.current;
      if (
        currentTopUrl &&
        url &&
        url !== currentTopUrl &&
        url !== activeRequest.url
      ) {
        return;
      }
      failHiddenWebviewRequest(
        activeRequest.id,
        new Error(
          description
            ? `fetchViaWebview: HTTP ${statusCode} (${description})`
            : `fetchViaWebview: HTTP ${statusCode}`,
        ),
      );
    },
    [activeRequest],
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      if (!activeRequest) {
        return false;
      }
      if (request.url === 'about:blank') {
        return true;
      }
      try {
        validateSameOriginUrl(request.url, activeRequest.allowedOrigin);
        if (request.isTopFrame !== false) {
          topFrameUrlRef.current = request.url;
        }
        return true;
      } catch (err) {
        if (request.isTopFrame !== false) {
          failHiddenWebviewRequest(
            activeRequest.id,
            err instanceof Error ? err : new Error(String(err)),
          );
        }
        return false;
      }
    },
    [activeRequest],
  );

  const source = useMemo(
    () => (activeRequest ? { uri: activeRequest.url } : undefined),
    [activeRequest],
  );

  if (!activeRequest || !source) {
    return null;
  }

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView<object>
        key={activeRequest.id}
        ref={webViewRef}
        source={source}
        userAgent={activeRequest.userAgent || defaultUserAgent}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        setSupportMultipleWindows={false}
        onLoadEnd={handleLoadEnd}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onMessage={handleMessage}
        onError={handleError}
        onHttpError={handleHttpError}
      />
    </View>
  );
};

export default HiddenWebViewHost;

const styles = StyleSheet.create({
  hiddenContainer: {
    height: 1,
    left: -10,
    opacity: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: -10,
    width: 1,
  },
});
