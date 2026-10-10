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
import defaultTo from 'lodash-es/defaultTo';
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
  /** The chapter being read. */
  const [chapter, setChapter] = useState(initialChapter);
  /**
   * The chapter the reader document was built for. It only differs from
   * `chapter` once infinite scrolling has carried the reader into a chapter
   * appended below it.
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
    pageReader,
    pageReaderInvertVolumeButtons,
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
  /** Increments on every adjacent lookup so only the latest one publishes. */
  const adjacentRequestIdRef = useRef(0);
  /** Every chapter in the reader document, by id. */
  const documentChaptersRef = useRef(new Map<number, ChapterInfo>());
  const documentHtmlRef = useRef(new Map<number, string>());

  useEffect(() => {
    // Progress saved since `chapter` was set lives only on the ref.
    if (chapterRef.current.id !== chapter.id) {
      chapterRef.current = chapter;
    }
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

  const volumeUpDelta = pageReaderInvertVolumeButtons ? 1 : -1;
  const volumeDownDelta = pageReaderInvertVolumeButtons ? -1 : 1;

  useEventListener(NativeVolumeButtonListener, 'VolumeUp', () => {
    webViewRef.current?.injectJavaScript(`(()=>{
      const isPaged = ${Boolean(pageReader)};
      if (isPaged && window.pageReader) {
        window.pageReader.movePage((window.pageReader.page?.val ?? 0) ${
          volumeUpDelta >= 0 ? '+' : '-'
        } 1);
      } else {
        window.scrollBy({top: -${volumeButtonOffset}, behavior: 'smooth'});
      }
    })()`);
  });

  useEventListener(NativeVolumeButtonListener, 'VolumeDown', () => {
    webViewRef.current?.injectJavaScript(`(()=>{
      const isPaged = ${Boolean(pageReader)};
      if (isPaged && window.pageReader) {
        window.pageReader.movePage((window.pageReader.page?.val ?? 0) ${
          volumeDownDelta >= 0 ? '+' : '-'
        } 1);
      } else {
        window.scrollBy({top: ${volumeButtonOffset}, behavior: 'smooth'});
      }
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

      const pending = loadChapterText(chap).then(text => {
        const sanitized = sanitizeChapterText(
          novel.pluginId,
          novel.name,
          chap.name,
          text,
        );
        if (!text.trim()) {
          chapterTextCache.remove(chap.id);
        }
        return sanitized;
      });
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
      const count = await getChapterCount(chap.novelId, page);
      if (count === 0) {
        const sourcePage = await fetchPage(novel.pluginId, novel.path, page);
        await insertChapters(
          chap.novelId,
          sourcePage.chapters.map(ch => ({ ...ch, page })),
        );
      }
      const query = direction === 'NEXT' ? getNextChapter : getPrevChapter;
      return query(
        chap.novelId,
        chap.position!,
        chap.page ?? '',
        excludedScanlators,
      );
    },
    [novel.path, novel.pluginId],
  );

  /** Pulls in the next source page when `chap` is the last of its page. */
  const loadNextPageChapter = useCallback(
    (chap: ChapterInfo, excludedScanlators: string[]) => {
      const totalPages = novel.totalPages ?? 0;
      const currentPage = Number(chap.page);
      if (totalPages > 0 && currentPage < totalPages) {
        return loadPageBoundaryChapter(
          chap,
          String(currentPage + 1),
          'NEXT',
          excludedScanlators,
        );
      }
      return Promise.resolve(undefined);
    },
    [loadPageBoundaryChapter, novel.totalPages],
  );

  /**
   * Resolves the neighbouring chapters *after* the current one is on screen.
   * These queries (and the page-boundary fetch above, which can hit the
   * network) used to gate the first paint even for downloaded chapters.
   */
  const resolveAdjacentChapters = useCallback(
    async (chap: ChapterInfo) => {
      const excludedScanlators = excludedScanlatorsRef.current || [];
      const loadId = loadIdRef.current;
      const requestId = ++adjacentRequestIdRef.current;
      const isStale = () =>
        loadId !== loadIdRef.current ||
        requestId !== adjacentRequestIdRef.current;
      const publish = (adjacent: AdjacentChapters) => {
        if (!isStale()) {
          setAdjacentChapter(adjacent);
        }
      };

      try {
        const [nextChapResult, prevChapResult] = await Promise.all([
          getNextChapter(
            chap.novelId,
            chap.position!,
            chap.page ?? '',
            excludedScanlators,
          ),
          getPrevChapter(
            chap.novelId,
            chap.position!,
            chap.page ?? '',
            excludedScanlators,
          ),
        ]);
        if (isStale()) {
          return;
        }

        let nextChap = nextChapResult;
        let prevChap = prevChapResult;
        publish([nextChap, prevChap]);
        prefetchChapter(nextChap);

        const currentPage = Number(chap.page);

        // Pull in the adjacent source pages if we are at a page boundary.
        if (!nextChap) {
          nextChap = await loadNextPageChapter(chap, excludedScanlators).catch(
            () => undefined,
          );
          if (isStale()) {
            return;
          }
          if (nextChap) {
            publish([nextChap, prevChap]);
            prefetchChapter(nextChap);
          }
        }
        if (!prevChap && currentPage > 1) {
          prevChap = await loadPageBoundaryChapter(
            chap,
            String(currentPage - 1),
            'PREV',
            excludedScanlators,
          ).catch(() => undefined);
          if (isStale()) {
            return;
          }
          if (prevChap) {
            publish([nextChap, prevChap]);
          }
        }
      } catch {
        // Neighbouring chapters are optional; the current chapter stays usable.
      }
    },
    [loadNextPageChapter, loadPageBoundaryChapter, prefetchChapter],
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
        documentChaptersRef.current = new Map([[chap.id, chap]]);
        documentHtmlRef.current = new Map([[chap.id, html]]);
        chapterRef.current = chap;
        setChapter(chap);
        setDocumentChapter(chap);
        setChapterText(html);
        setAdjacentChapter(NO_ADJACENT_CHAPTERS);
        setLoading(false);

        void resolveAdjacentChapters(chap);
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
    (chapterName: string) => {
      const chapterNumber = parseChapterNumber(novel.name, chapterName);
      if (tracker && trackedNovel && chapterNumber > trackedNovel.progress) {
        updateAllTrackedNovels({ progress: chapterNumber });
      }
    },
    [novel.name, trackedNovel, tracker, updateAllTrackedNovels],
  );

  const markedReadRef = useRef<number | undefined>(undefined);
  /**
   * `chapterId` names the chapter the progress belongs to, which is not
   * necessarily the current one: infinite scrolling reports a chapter as read
   * as the reader scrolls out of it.
   */
  const saveProgress = useCallback(
    (percentage: number, chapterId?: number) => {
      const target =
        chapterId === undefined
          ? chapterRef.current
          : documentChaptersRef.current.get(chapterId);
      // Unknown ids come from a document that has since been replaced.
      if (!target) {
        return;
      }
      const progress = percentage > 100 ? 100 : percentage;
      // The latest position, even after scrolling back and in incognito mode:
      // a rebuilt reader document restores where the reader actually is.
      const updated = { ...target, progress };
      documentChaptersRef.current.set(updated.id, updated);
      if (chapterRef.current.id === updated.id) {
        chapterRef.current = updated;
      }
      if (incognitoMode) {
        return;
      }
      updateChapterProgress(target.id, progress);

      // Progress is reported repeatedly while reading the end of a chapter;
      // marking it read (and pushing it to the tracker, which is a network
      // call) only has to happen once.
      if (percentage >= 97 && markedReadRef.current !== target.id) {
        // a relative number
        markedReadRef.current = target.id;
        markChapterRead(target.id);
        updateTracker(target.name);
      }
    },
    [incognitoMode, markChapterRead, updateChapterProgress, updateTracker],
  );

  /**
   * Makes a chapter that infinite scrolling appended to the document the
   * current one, without reloading the document.
   */
  const activateChapter = useCallback(
    (chapterId: number) => {
      const chap = documentChaptersRef.current.get(chapterId);
      if (!chap || chap.id === chapterRef.current.id) {
        return;
      }
      chapterRef.current = chap;
      setChapter(chap);
      void resolveAdjacentChapters(chap);
    },
    [resolveAdjacentChapters],
  );

  /**
   * Loads the chapter after `chapterId` for infinite scrolling, resolving to
   * `null` when there is none.
   */
  const loadChapterAfter = useCallback(
    async (chapterId: number) => {
      const documentChapters = documentChaptersRef.current;
      const after = documentChapters.get(chapterId);
      if (!after) {
        throw new Error(`Chapter ${chapterId} is not in the reader`);
      }
      const excludedScanlators = excludedScanlatorsRef.current || [];
      const next =
        (await getNextChapter(
          after.novelId,
          after.position!,
          after.page ?? '',
          excludedScanlators,
        )) ?? (await loadNextPageChapter(after, excludedScanlators));
      if (!next) {
        return null;
      }
      const html = await loadChapterHtml(next);
      documentChapters.set(next.id, next);
      documentHtmlRef.current.set(next.id, html);
      return { chapter: next, html };
    },
    [loadChapterHtml, loadNextPageChapter],
  );

  /**
   * What a rebuilt reader document must be made of: the chapter being read,
   * at the progress reached so far, rather than the chapter it was first
   * built for.
   */
  const getRebuildTarget = useCallback(() => {
    const active = chapterRef.current;
    const html = documentHtmlRef.current.get(active.id);
    return html === undefined ? undefined : { chapter: active, html };
  }, []);

  /**
   * Forgets the chapters infinite scrolling has dropped from the reader
   * document, so a long session does not keep every chapter it went through.
   */
  const dropChapters = useCallback((chapterIds: number[]) => {
    for (const id of chapterIds) {
      if (id !== chapterRef.current.id) {
        documentChaptersRef.current.delete(id);
        documentHtmlRef.current.delete(id);
      }
    }
  }, []);

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
    chapterTextCache.remove(chapterRef.current.id);
    setLoading(true);
    setError('');
    getChapter();
  }, [chapterTextCache, getChapter]);

  /**
   * Everything except `hidden`, which toggles on every tap on the page. Keeping
   * it out of this object is what lets the WebView, the drawer and the searchbar
   * skip re-rendering when the reader UI is shown or hidden.
   */
  const chapterContext = useMemo(
    () => ({
      chapter,
      nextChapter,
      prevChapter,
      error,
      loading,
      chapterText,
      documentChapter,
      setHidden,
      saveProgress,
      activateChapter,
      loadChapterAfter,
      getRebuildTarget,
      dropChapters,
      hideHeader,
      navigateChapter,
      navigateChapterSearch,
      searchChapterText,
      clearChapterSearch,
      refetch,
      setChapter,
      setLoading,
      getChapter,
      onUserInteraction,
      isTTSReadingRef,
    }),
    [
      chapter,
      nextChapter,
      prevChapter,
      error,
      loading,
      chapterText,
      documentChapter,
      saveProgress,
      activateChapter,
      loadChapterAfter,
      getRebuildTarget,
      dropChapters,
      hideHeader,
      navigateChapter,
      navigateChapterSearch,
      searchChapterText,
      clearChapterSearch,
      refetch,
      getChapter,
      onUserInteraction,
      isTTSReadingRef,
    ],
  );

  return { hidden, chapterContext };
}
