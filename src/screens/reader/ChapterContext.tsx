import { createContext, useContext, useRef, type ReactNode } from 'react';
import type WebView from 'react-native-webview';

import type { ChapterInfo, NovelInfo } from '@database/types';
import useChapter, { type ReaderSession } from './hooks/useChapter';

interface ReaderWebViewBinding {
  ref: React.RefObject<WebView<object> | null>;
  source: { html: string };
  onMessage: ReturnType<typeof useChapter>['webView']['onMessage'];
}

const ChapterContext = createContext<ReaderSession | null>(null);
const WebViewContext = createContext<ReaderWebViewBinding | null>(null);

/**
 * Whether the reader chrome is hidden. It lives in its own context because it
 * changes on every tap, and a context value change re-renders every consumer -
 * only the screen that draws the appbar and footer cares about it.
 */
const ReaderChromeHiddenContext = createContext<boolean>(true);

export function ChapterContextProvider({
  children,
  novel,
  initialChapter,
}: {
  children: ReactNode;
  novel: NovelInfo;
  initialChapter: ChapterInfo;
}) {
  const webViewRef = useRef<WebView<object>>(null);
  const { hidden, session, webView } = useChapter(
    webViewRef,
    novel,
    initialChapter,
  );
  return (
    <ChapterContext.Provider value={session}>
      <WebViewContext.Provider value={{ ref: webViewRef, ...webView }}>
        <ReaderChromeHiddenContext.Provider value={hidden}>
          {children}
        </ReaderChromeHiddenContext.Provider>
      </WebViewContext.Provider>
    </ChapterContext.Provider>
  );
}

export const useChapterContext = (): ReaderSession => {
  const session = useContext(ChapterContext);
  if (!session) {
    throw new Error('useChapterContext outside ChapterContextProvider');
  }
  return session;
};

export const useReaderWebView = (): ReaderWebViewBinding => {
  const binding = useContext(WebViewContext);
  if (!binding) {
    throw new Error('useReaderWebView outside ChapterContextProvider');
  }
  return binding;
};

export const useReaderChromeHidden = () =>
  useContext(ReaderChromeHiddenContext);
