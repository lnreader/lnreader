import {
  getChapter as getDbChapter,
  getChapterCount,
  getNextChapter,
  getPrevChapter,
  insertChapters,
} from '@database/queries/ChapterQueries';
import { insertHistory } from '@database/queries/HistoryQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import {
  useAppSettings,
  useChapterGeneralSettings,
  useLibrarySettings,
  useTrackedNovel,
  useTracker,
} from '@hooks/persisted';
import { fetchChapter, fetchPage } from '@services/plugin/fetch';
import { NOVEL_STORAGE } from '@utils/Storages';
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { sanitizeChapterText } from '../utils/sanitizeChapterText';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import WebView from 'react-native-webview';
import { useFullscreenMode } from '@hooks';
import { Dimensions } from 'react-native';
import { runWhenIdle } from '@utils/runWhenIdle';
import { defaultTo } from 'lodash-es';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import NativeVolumeButtonListener from '@modules/native-volume-button-listener';
import NativeFile from '@modules/native-file';
import { useNovelActions, useNovelValue } from '@screens/novel/NovelContext';
import useTimeTracking from './useTimeTracking';
import { useEventListener } from 'expo';

type AdjacentChapters = [
  nextChapter: ChapterInfo | undefined,
  prevChapter: ChapterInfo | undefined,
];

/** Stable identity so resetting the adjacent chapters never renders twice. */
const NO_ADJACENT_CHAPTERS: AdjacentChapters = [undefined, undefined];

export type ChapterDirection = 'NEXT' | 'PREV';

/**
 * `injectJavaScript` evaluates its argument as source, where the line separator
 * characters JSON leaves unescaped are not valid inside a string literal.
 */
const toInjectableJSON = (value: unknown) =>
  JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export default function useChapter(
  webViewRef: RefObject<WebView | null>,
  initialChapter: ChapterInfo,
  novel: NovelInfo,
) {
  const {
    setLastRead,
    markChapterRead,
    updateChapterProgress,
    increaseTimeSpent,
    chapterTextCache,
  } = useNovelActions();
  const novelSettings = useNovelValue('novelSettings');

  const [hidden, setHidden] = useState(true);
  const [chapter, setChapter] = useState(initialChapter);
  /**
   * The chapter the WebView document was built from. In continuous reading the
   * document outlives the chapter being read - it grows with every chapter
   * scrolled into - so anything that would rebuild (and therefore reload) the
   * document has to key off this instead of the active chapter.
   */
  const [documentChapter, setDocumentChapter] = useState(initialChapter);
  const [loading, setLoading] = useState(true);
  const [chapterText, setChapterText] = useState('');

  const [[nextChapter, prevChapter], setAdjacentChapter] =
    useState<AdjacentChapters>(NO_ADJACENT_CHAPTERS);
  const {
    autoScroll,
    autoScrollInterval,
    autoScrollOffset,
    useVolumeButtons,
    volumeButtonsOffset,
  } = useChapterGeneralSettings();
  const { incognitoMode } = useLibrarySettings();
  const { timeTrackingEnabled, inactivityTimeoutMs } = useAppSettings();
  const [error, setError] = useState<string>();
  const { tracker } = useTracker();
  const { trackedNovel, updateAllTrackedNovels } = useTrackedNovel(novel.id);
  const { setImmersiveMode, showStatusAndNavBar } = useFullscreenMode();

  const { onUserInteraction, isTTSReadingRef } = useTimeTracking(
    chapter.id,
    incognitoMode || false,
    inactivityTimeoutMs,
    timeTrackingEnabled,
    increaseTimeSpent,
  );

  /**
   * Mirrors of state that async work reads. Keeping them in refs is what makes
   * `getChapter` & friends referentially stable: an unstable `getChapter` would
   * invalidate the whole ChapterContext value on every chapter change and
   * re-render the appbar, footer, drawer and WebView with it.
   */
  const chapterRef = useRef(chapter);
  const adjacentChapterRef = useRef<AdjacentChapters>(NO_ADJACENT_CHAPTERS);
  const excludedScanlatorsRef = useRef(novelSettings?.excludedScanlators);
  const hiddenRef = useRef(hidden);
  /** Increments on every load so a superseded load can never publish state. */
  const loadIdRef = useRef(0);

  /**
   * Continuous reading bookkeeping. Every chapter that has been streamed into
   * the document, plus the two chapters at its ends - the ones the next
   * inline load extends from. The WebView drops chapters it has scrolled far
   * past and reports the new ends, so `edges` is not simply first/last loaded.
   */
  const streamedChaptersRef = useRef(new Map<number, ChapterInfo>());
  const streamEdgesRef = useRef<{
    head: ChapterInfo | undefined;
    tail: ChapterInfo | undefined;
  }>({ head: undefined, tail: undefined });
  const inlineLoadRef = useRef<Record<ChapterDirection, boolean>>({
    NEXT: false,
    PREV: false,
  });

  useEffect(() => {
    chapterRef.current = chapter;
  }, [chapter]);

  useEffect(() => {
    adjacentChapterRef.current = [nextChapter, prevChapter];
  }, [nextChapter, prevChapter]);

  useEffect(() => {
    excludedScanlatorsRef.current = novelSettings?.excludedScanlators;
  }, [novelSettings?.excludedScanlators]);

  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  const volumeButtonOffset = defaultTo(
    volumeButtonsOffset,
    Math.round(Dimensions.get('window').height * 0.75),
  );

  useEventListener(NativeVolumeButtonListener, 'VolumeUp', () => {
    webViewRef.current?.injectJavaScript(`(()=>{
      window.scrollBy({top: -${volumeButtonOffset}, behavior: 'smooth'})
    })()`);
  });

  useEventListener(NativeVolumeButtonListener, 'VolumeDown', () => {
    webViewRef.current?.injectJavaScript(`(()=>{
      window.scrollBy({top: ${volumeButtonOffset}, behavior: 'smooth'})
    })()`);
  });

  useEffect(() => {
    NativeVolumeButtonListener.setActive(useVolumeButtons);
    return () => NativeVolumeButtonListener.setActive(false);
  }, [useVolumeButtons]);

  /**
   * Reads the chapter from local storage, falling back to the plugin when it
   * is not downloaded. A single `readFile` doubles as the existence check to
   * save a native round trip on the critical path of a downloaded chapter.
   */
  const loadChapterText = useCallback(
    async (chap: ChapterInfo) => {
      const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${chap.novelId}/${chap.id}/index.html`;
      try {
        return await NativeFile.readFile(filePath);
      } catch {
        return await fetchChapter(novel.pluginId, chap.path);
      }
    },
    [novel.pluginId],
  );

  /**
   * Returns render-ready (sanitized) chapter HTML, reusing the novel-scoped
   * cache. Sanitizing before caching keeps `sanitize-html` – which is the most
   * expensive synchronous step of a chapter load – off the critical path for
   * prefetched chapters. In-flight loads are cached as promises so the same
   * chapter is never loaded twice concurrently.
   */
  const loadChapterHtml = useCallback(
    (chap: ChapterInfo): string | Promise<string> => {
      const cached = chapterTextCache.read(chap.id);
      if (cached) {
        return cached;
      }

      const pending = loadChapterText(chap).then(text =>
        sanitizeChapterText(novel.pluginId, novel.name, chap.name, text),
      );
      chapterTextCache.write(chap.id, pending);
      // Never keep a failed load in the cache, otherwise a retry would
      // resolve instantly with the same failure.
      pending.catch(() => chapterTextCache.remove(chap.id));

      return pending;
    },
    [chapterTextCache, loadChapterText, novel.name, novel.pluginId],
  );

  const prefetchChapter = useCallback(
    (chap?: ChapterInfo) => {
      if (!chap || chapterTextCache.read(chap.id)) {
        return;
      }
      // Deliberately deferred: prefetching during the current chapter's load
      // competes with it for the JS thread, storage and the network.
      runWhenIdle(() => {
        const pending = loadChapterHtml(chap);
        if (typeof pending !== 'string') {
          pending.catch(() => {});
        }
      });
    },
    [chapterTextCache, loadChapterHtml],
  );

  /**
   * Materialises the first/last chapter of an adjacent source page, fetching
   * that page from the plugin when it is not in the database yet.
   */
  const loadPageBoundaryChapter = useCallback(
    async (
      chap: ChapterInfo,
      page: string,
      direction: 'NEXT' | 'PREV',
      excludedScanlators: string[],
    ) => {
      try {
        const count = await getChapterCount(chap.novelId, page);
        if (count === 0) {
          const sourcePage = await fetchPage(novel.pluginId, novel.path, page);
          await insertChapters(
            chap.novelId,
            sourcePage.chapters.map(ch => ({ ...ch, page })),
          );
        }
        const query = direction === 'NEXT' ? getNextChapter : getPrevChapter;
        return await query(
          chap.novelId,
          chap.position!,
          chap.page ?? '',
          excludedScanlators,
        );
      } catch {
        return undefined;
      }
    },
    [novel.path, novel.pluginId],
  );

  /**
   * Resolves the chapter next to `chap`, pulling in the adjacent source page
   * when `chap` sits on a page boundary. `onDbResult` reports what the database
   * alone had, which is everything except at a boundary - where finding the
   * neighbour means going to the network.
   */
  const resolveNeighbour = useCallback(
    async (
      chap: ChapterInfo,
      direction: ChapterDirection,
      onDbResult?: (result: ChapterInfo | undefined) => void,
    ) => {
      const excludedScanlators = excludedScanlatorsRef.current || [];
      const query = direction === 'NEXT' ? getNextChapter : getPrevChapter;
      const fromDb = await query(
        chap.novelId,
        chap.position!,
        chap.page ?? '',
        excludedScanlators,
      );
      onDbResult?.(fromDb);
      if (fromDb) {
        return fromDb;
      }

      const currentPage = Number(chap.page);
      if (direction === 'NEXT') {
        const totalPages = novel.totalPages ?? 0;
        if (totalPages > 0 && currentPage < totalPages) {
          return loadPageBoundaryChapter(
            chap,
            String(currentPage + 1),
            'NEXT',
            excludedScanlators,
          );
        }
      } else if (currentPage > 1) {
        return loadPageBoundaryChapter(
          chap,
          String(currentPage - 1),
          'PREV',
          excludedScanlators,
        );
      }
      return undefined;
    },
    [loadPageBoundaryChapter, novel.totalPages],
  );

  /**
   * Resolves the neighbouring chapters *after* the current one is on screen.
   * These queries (and the page-boundary fetch above, which can hit the
   * network) used to gate the first paint even for downloaded chapters.
   */
  const resolveAdjacentChapters = useCallback(
    async (chap: ChapterInfo, loadId: number) => {
      const isStale = () => loadId !== loadIdRef.current;
      const publish = (adjacent: AdjacentChapters) => {
        if (!isStale()) {
          setAdjacentChapter(adjacent);
        }
      };

      try {
        // Published as soon as both database lookups are in, so the reader is
        // not left without a next chapter while a page boundary is fetched.
        let dbNext: ChapterInfo | undefined;
        let dbPrev: ChapterInfo | undefined;
        let dbResults = 0;
        const onDbResults = () => {
          if (++dbResults === 2) {
            publish([dbNext, dbPrev]);
            prefetchChapter(dbNext);
          }
        };

        const [nextChap, prevChap] = await Promise.all([
          resolveNeighbour(chap, 'NEXT', result => {
            dbNext = result;
            onDbResults();
          }),
          resolveNeighbour(chap, 'PREV', result => {
            dbPrev = result;
            onDbResults();
          }),
        ]);
        if (isStale()) {
          return;
        }

        publish([nextChap, prevChap]);
        prefetchChapter(nextChap);
      } catch {
        // Neighbouring chapters are optional; the current chapter stays usable.
      }
    },
    [prefetchChapter, resolveNeighbour],
  );

  const getChapter = useCallback(
    async (navChapter?: ChapterInfo) => {
      const loadId = ++loadIdRef.current;
      const isStale = () => loadId !== loadIdRef.current;
      const requested = navChapter ?? chapterRef.current;

      try {
        // Start the text load first: it is the only thing needed to paint.
        const htmlPromise = loadChapterHtml(requested);
        const [dbChapter, html] = await Promise.all([
          navChapter ? undefined : getDbChapter(requested.id),
          htmlPromise,
        ]);
        if (isStale()) {
          return;
        }

        const chap = dbChapter ?? requested;
        setChapter(chap);
        setDocumentChapter(chap);
        setChapterText(html);
        setAdjacentChapter(NO_ADJACENT_CHAPTERS);
        setLoading(false);

        // The document about to be built holds this chapter and nothing else.
        streamedChaptersRef.current = new Map([[chap.id, chap]]);
        streamEdgesRef.current = { head: chap, tail: chap };

        void resolveAdjacentChapters(chap, loadId);
      } catch (e: any) {
        if (isStale()) {
          return;
        }
        setError(e.message);
        setLoading(false);
      }
    },
    [loadChapterHtml, resolveAdjacentChapters],
  );

  /**
   * Streams the chapter following (or preceding) the loaded ones into the open
   * document, for continuous reading. Nothing here reloads the WebView: the
   * markup is handed to the page, which splices it in around the reading
   * position itself.
   */
  const loadInlineChapter = useCallback(
    async (direction: ChapterDirection) => {
      if (inlineLoadRef.current[direction]) {
        return;
      }
      inlineLoadRef.current[direction] = true;
      const loadId = loadIdRef.current;
      const isStale = () => loadId !== loadIdRef.current;
      let inserted = false;

      try {
        const edge =
          direction === 'NEXT'
            ? streamEdgesRef.current.tail
            : streamEdgesRef.current.head;
        if (!edge) {
          return;
        }

        const neighbour = await resolveNeighbour(edge, direction);
        if (isStale()) {
          return;
        }
        if (!neighbour) {
          inserted = true;
          webViewRef.current?.injectJavaScript(
            `window.continuousReader?.setEdgeReached(${toInjectableJSON(
              direction,
            )}); true;`,
          );
          return;
        }

        const html = await loadChapterHtml(neighbour);
        if (isStale()) {
          return;
        }

        streamedChaptersRef.current.set(neighbour.id, neighbour);
        if (direction === 'NEXT') {
          streamEdgesRef.current.tail = neighbour;
        } else {
          streamEdgesRef.current.head = neighbour;
        }
        inserted = true;
        webViewRef.current?.injectJavaScript(
          `window.continuousReader?.insertChapter(${toInjectableJSON({
            direction,
            chapter: neighbour,
            html,
          })}); true;`,
        );

        // Keep the one after it warm so the next hand-off costs a lookup and
        // nothing else.
        void resolveNeighbour(neighbour, direction)
          .then(prefetchChapter)
          .catch(() => {});
      } catch {
        // Leaves the reader where it is; the page asks again on the next scroll.
      } finally {
        inlineLoadRef.current[direction] = false;
        if (!inserted && !isStale()) {
          webViewRef.current?.injectJavaScript(
            `window.continuousReader?.cancelPending(${toInjectableJSON(
              direction,
            )}); true;`,
          );
        }
      }
    },
    [loadChapterHtml, prefetchChapter, resolveNeighbour, webViewRef],
  );

  /**
   * Follows the chapter the reader has scrolled into, in continuous reading.
   * Everything chapter-scoped outside the document - the appbar title, the
   * bookmark, history, the drawer's highlight - keys off this.
   */
  const setActiveChapter = useCallback(
    (chapterId: number) => {
      const chap = streamedChaptersRef.current.get(chapterId);
      if (!chap || chap.id === chapterRef.current.id) {
        return;
      }
      chapterRef.current = chap;
      setChapter(chap);
      setAdjacentChapter(NO_ADJACENT_CHAPTERS);
      void resolveAdjacentChapters(chap, loadIdRef.current);
    },
    [resolveAdjacentChapters],
  );

  /**
   * The page drops chapters it has scrolled well past, so it - not this hook -
   * knows which chapters the stream currently extends from.
   */
  const setStreamEdges = useCallback(
    (headChapterId: number, tailChapterId: number) => {
      const head = streamedChaptersRef.current.get(headChapterId);
      const tail = streamedChaptersRef.current.get(tailChapterId);
      if (head) {
        streamEdgesRef.current.head = head;
      }
      if (tail) {
        streamEdgesRef.current.tail = tail;
      }
    },
    [],
  );

  const searchChapterText = useCallback(
    (text: string) => {
      webViewRef.current?.injectJavaScript(
        `window.readerSearch?.search(${JSON.stringify(text)}); true;`,
      );
    },
    [webViewRef],
  );

  const clearChapterSearch = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.readerSearch?.clear(); true;');
  }, [webViewRef]);

  const navigateChapterSearch = useCallback(
    (direction: 'NEXT' | 'PREV', text: string) => {
      const method = direction === 'NEXT' ? 'next' : 'previous';
      webViewRef.current?.injectJavaScript(
        `window.readerSearch?.${method}(${JSON.stringify(text)}); true;`,
      );
    },
    [webViewRef],
  );

  const scrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!autoScroll) {
      return undefined;
    }

    scrollInterval.current = setInterval(() => {
      webViewRef.current?.injectJavaScript(`(()=>{
        window.scrollBy({top:${defaultTo(
          autoScrollOffset,
          Dimensions.get('window').height,
        )},behavior:'smooth'})
      })()`);
    }, autoScrollInterval * 1000);

    return () => {
      if (scrollInterval.current) {
        clearInterval(scrollInterval.current);
        scrollInterval.current = null;
      }
    };
  }, [autoScroll, autoScrollInterval, autoScrollOffset, webViewRef]);

  const updateTracker = useCallback(
    (chap: ChapterInfo) => {
      const chapterNumber = parseChapterNumber(novel.name, chap.name);
      if (tracker && trackedNovel && chapterNumber > trackedNovel.progress) {
        updateAllTrackedNovels({ progress: chapterNumber });
      }
    },
    [novel.name, trackedNovel, tracker, updateAllTrackedNovels],
  );

  const markedReadRef = useRef(new Set<number>());
  /**
   * `chapterId` is only passed in continuous reading, where progress can land
   * on a chapter that is no longer the one being read - the reader has already
   * scrolled into the next one.
   */
  const saveProgress = useCallback(
    (percentage: number, chapterId?: number) => {
      if (incognitoMode) {
        return;
      }

      const chap =
        (chapterId === undefined
          ? undefined
          : streamedChaptersRef.current.get(chapterId)) ?? chapterRef.current;
      updateChapterProgress(chap.id, percentage > 100 ? 100 : percentage);

      // Progress is reported repeatedly while reading the end of a chapter;
      // marking it read (and pushing it to the tracker, which is a network
      // call) only has to happen once.
      if (percentage >= 97 && !markedReadRef.current.has(chap.id)) {
        // a relative number
        markedReadRef.current.add(chap.id);
        markChapterRead(chap.id);
        updateTracker(chap);
      }
    },
    [incognitoMode, markChapterRead, updateChapterProgress, updateTracker],
  );

  const hideHeader = useCallback(() => {
    const nextHidden = !hiddenRef.current;
    // Updated here as well as in the effect below so two taps within the same
    // tick cannot both read the pre-toggle value.
    hiddenRef.current = nextHidden;
    webViewRef.current?.injectJavaScript(
      `reader.hidden.val = ${nextHidden ? 'true' : 'false'}`,
    );
    if (nextHidden) {
      setImmersiveMode();
    } else {
      showStatusAndNavBar();
    }
    setHidden(nextHidden);
  }, [setImmersiveMode, showStatusAndNavBar, webViewRef]);

  const navigateChapter = useCallback(
    (position: 'NEXT' | 'PREV') => {
      const [next, prev] = adjacentChapterRef.current;
      const navChapter = position === 'NEXT' ? next : prev;

      if (navChapter) {
        getChapter(navChapter);
      } else {
        showToast(
          position === 'NEXT'
            ? getString('readerScreen.noNextChapter')
            : getString('readerScreen.noPreviousChapter'),
        );
      }
    },
    [getChapter],
  );

  // Keep the history/last-read entry up to date, off the critical path of the
  // chapter load: neither write is needed to render the chapter.
  useEffect(() => {
    if (incognitoMode) {
      return undefined;
    }

    const chapterId = chapter.id;
    let started = false;
    const cancel = runWhenIdle(() => {
      started = true;
      insertHistory(chapterId);
      getDbChapter(chapterId).then(result => result && setLastRead(result));
    });

    return () => {
      cancel();
      if (!started) {
        insertHistory(chapterId);
      }
      getDbChapter(chapterId).then(result => result && setLastRead(result));
    };
  }, [incognitoMode, setLastRead, chapter.id]);

  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) {
      return;
    }
    initialLoadRef.current = true;
    getChapter();
  }, [getChapter]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError('');
    getChapter();
  }, [getChapter]);

  /**
   * Everything except `hidden`, which toggles on every tap on the page. Keeping
   * it out of this object is what lets the WebView, the drawer and the searchbar
   * skip re-rendering when the reader UI is shown or hidden.
   */
  const chapterContext = useMemo(
    () => ({
      chapter,
      documentChapter,
      nextChapter,
      prevChapter,
      error,
      loading,
      chapterText,
      setHidden,
      saveProgress,
      hideHeader,
      navigateChapter,
      navigateChapterSearch,
      searchChapterText,
      clearChapterSearch,
      refetch,
      setChapter,
      setLoading,
      getChapter,
      loadInlineChapter,
      setActiveChapter,
      setStreamEdges,
      onUserInteraction,
      isTTSReadingRef,
    }),
    [
      chapter,
      documentChapter,
      nextChapter,
      prevChapter,
      error,
      loading,
      chapterText,
      saveProgress,
      hideHeader,
      navigateChapter,
      navigateChapterSearch,
      searchChapterText,
      clearChapterSearch,
      refetch,
      getChapter,
      loadInlineChapter,
      setActiveChapter,
      setStreamEdges,
      onUserInteraction,
      isTTSReadingRef,
    ],
  );

  return { hidden, chapterContext };
}
