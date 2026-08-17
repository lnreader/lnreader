import { useCallback, useMemo, useRef, useState } from 'react';
import WebView, { WebViewNavigation } from 'react-native-webview';
import type { WebViewProgressEvent } from 'react-native-webview/lib/WebViewTypes';
import { ProgressBar } from 'react-native-paper';

import { getPlugin } from '@plugins/pluginManager';
import { useBackHandler } from '@hooks';
import { useTheme } from '@hooks/persisted';
import { WebviewScreenProps } from '@navigators/types';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { resolveUrl } from '@services/plugin/fetch';
import {
  WEBVIEW_LOCAL_STORAGE,
  WEBVIEW_SESSION_STORAGE,
  store,
} from '@plugins/helpers/storage';
import Appbar from './components/Appbar';
import Menu from './components/Menu';

type StorageData = {
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
};

const WebviewScreen = ({ route, navigation }: WebviewScreenProps) => {
  const { name, url, pluginId, isNovel } = route.params;
  const isSave = getPlugin(pluginId)?.webStorageUtilized;
  const uri = useMemo(
    () => resolveUrl(pluginId, url, isNovel),
    [isNovel, pluginId, url],
  );
  const userAgent = useMemo(() => getUserAgent(), []);

  const theme = useTheme();
  const webViewRef = useRef<WebView<object> | null>(null);

  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState(name || '');
  const [currentUrl, setCurrentUrl] = useState(uri);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [tempData, setTempData] = useState<StorageData>();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleNavigation = (e: WebViewNavigation) => {
    if (!e.loading) {
      setTitle(e.title);
    }
    setCurrentUrl(e.url);
    setCanGoBack(e.canGoBack);
    setCanGoForward(e.canGoForward);
  };

  const handleLoadProgress = useCallback(
    ({ nativeEvent }: WebViewProgressEvent) => {
      const next = nativeEvent.progress;
      // Progress is reported continuously: re-rendering the screen (and with
      // it the WebView element) for sub-percent changes is wasted work.
      setProgress(current =>
        next === 1 || Math.abs(next - current) >= 0.05 ? next : current,
      );
    },
    [],
  );

  const saveData = () => {
    if (pluginId && tempData && isSave) {
      store.set(
        pluginId + WEBVIEW_LOCAL_STORAGE,
        JSON.stringify(tempData?.localStorage || {}),
      );
      store.set(
        pluginId + WEBVIEW_SESSION_STORAGE,
        JSON.stringify(tempData?.sessionStorage || {}),
      );
    }
  };

  useBackHandler(() => {
    if (menuVisible) {
      setMenuVisible(false);
      return true;
    }
    if (canGoBack) {
      webViewRef.current?.goBack();
      return true;
    }
    saveData();
    return false;
  });

  const injectJavaScriptCode =
    'window.ReactNativeWebView.postMessage(JSON.stringify({localStorage, sessionStorage}))';

  // A new `source` reloads the page, so keep it stable across progress updates
  // and only replace it when the route or the address bar asks for a new page.
  const [source, setSource] = useState(() => ({ uri }));
  const [routeUri, setRouteUri] = useState(uri);
  if (routeUri !== uri) {
    setRouteUri(uri);
    setSource({ uri });
  }

  const navigateTo = useCallback(
    (target: string) => {
      if (source.uri !== target) {
        setSource({ uri: target });
        setCurrentUrl(target);
      } else if (target === currentUrl) {
        webViewRef.current?.reload();
      } else {
        // `source` already holds this address, so a new prop would be diffed
        // away before reaching the native side; navigate from inside the page.
        webViewRef.current?.injectJavaScript(
          `window.location.href = ${JSON.stringify(target)}; true;`,
        );
      }
    },
    [currentUrl, source.uri],
  );

  return (
    <>
      <Appbar
        title={title}
        currentUrl={currentUrl}
        theme={theme}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        webView={webViewRef}
        setMenuVisible={setMenuVisible}
        navigateTo={navigateTo}
        goBack={() => {
          saveData();
          navigation.goBack();
        }}
      />
      <ProgressBar
        color={theme.primary}
        progress={Math.round(1000 * progress) / 1000}
        visible={progress !== 1}
      />
      <WebView<object>
        userAgent={userAgent}
        ref={webViewRef}
        source={source}
        setDisplayZoomControls={true}
        setBuiltInZoomControls={false}
        setSupportMultipleWindows={false}
        injectedJavaScript={injectJavaScriptCode}
        onNavigationStateChange={handleNavigation}
        onLoadProgress={handleLoadProgress}
        onMessage={({ nativeEvent }: { nativeEvent: { data: string } }) =>
          setTempData(JSON.parse(nativeEvent.data))
        }
      />
      {menuVisible ? (
        <Menu
          theme={theme}
          currentUrl={currentUrl}
          webView={webViewRef}
          setMenuVisible={setMenuVisible}
        />
      ) : null}
    </>
  );
};

export default WebviewScreen;
