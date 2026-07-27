import React, { createContext, useContext, useMemo, useRef } from 'react';
import { ChapterInfo, NovelInfo } from '@database/types';
import WebView from 'react-native-webview';
import useChapter from './hooks/useChapter';
import useChapterTranslation, {
  type ChapterTranslation,
} from './hooks/useChapterTranslation';

type ChapterContextType = ReturnType<typeof useChapter>['chapterContext'] &
  ChapterTranslation & {
    novel: NovelInfo;
    webViewRef: React.RefObject<WebView<object> | null>;
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

  const { displayedHtml, translation } = useChapterTranslation(
    novel,
    chapterContext.chapter,
    chapterContext.chapterText,
  );

  const contextValue = useMemo(
    () => ({
      novel,
      webViewRef,
      ...chapterContext,
      ...translation,
      // Consumers render `chapterText` without knowing translation exists;
      // swapping it here keeps the WebView and TTS on one code path.
      chapterText: displayedHtml,
    }),
    [novel, webViewRef, chapterContext, translation, displayedHtml],
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
