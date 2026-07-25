import React, { createContext, useContext, useMemo, useRef } from 'react';
import { ChapterInfo, NovelInfo } from '@database/types';
import WebView from 'react-native-webview';
import useChapter from './hooks/useChapter';

type ChapterContextType = ReturnType<typeof useChapter>['chapterContext'] & {
  novel: NovelInfo;
  webViewRef: React.RefObject<WebView<{}> | null>;
};

const defaultValue = {} as ChapterContextType;

const ChapterContext = createContext<ChapterContextType>(defaultValue);

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
  children: React.JSX.Element;
  novel: NovelInfo;
  initialChapter: ChapterInfo;
}) {
  const webViewRef = useRef<WebView>(null);
  const { hidden, chapterContext } = useChapter(
    webViewRef,
    initialChapter,
    novel,
  );

  const contextValue = useMemo(
    () => ({
      novel,
      webViewRef,
      ...chapterContext,
    }),
    [novel, webViewRef, chapterContext],
  );

  return (
    <ChapterContext.Provider value={contextValue}>
      <ReaderChromeHiddenContext.Provider value={hidden}>
        {children}
      </ReaderChromeHiddenContext.Provider>
    </ChapterContext.Provider>
  );
}

export const useChapterContext = () => {
  return useContext(ChapterContext);
};

export const useReaderChromeHidden = () => {
  return useContext(ReaderChromeHiddenContext);
};
