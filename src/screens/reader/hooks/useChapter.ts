import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, NativeEventEmitter, NativeModules } from 'react-native';
import * as Linking from 'expo-linking';
import { useEventListener } from 'expo';
import type WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { getBatteryLevel } from 'react-native-device-info';

import { getChapter as getDbChapter } from '@database/queries/ChapterQueries';
import { insertHistory } from '@database/queries/HistoryQueries';
import { getReaderChapters } from '@database/queries/ReaderQueries';
import type { ChapterInfo, NovelInfo } from '@database/types';
import { useFullscreenMode } from '@hooks';
import {
  useAppSettings,
  useChapterGeneralSettings,
  useChapterReaderSettings,
  useLibrarySettings,
  useTheme,
  useTrackedNovel,
  useTracker,
} from '@hooks/persisted';
import { getString } from '@i18n/translations';
import NativeVolumeButtonListener from '@modules/native-volume-button-listener';
import type { TtsSettings } from '@modules/nitro-tts';
import { getPlugin } from '@plugins/pluginManager';
import { useNovelActions, useNovelValue } from '@screens/novel/NovelContext';
import { applyTextModifications } from '@utils/customCode';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import { getReaderAssetsUri, READER_FONTS_URI } from '@utils/readerAssets';
import { runWhenIdle } from '@utils/runWhenIdle';
import { showToast } from '@utils/showToast';
import { PLUGIN_STORAGE } from '@utils/Storages';
import { toReaderPreferences } from '../engine/preferences';
import {
  type NativeToWebMessage,
  parseWebMessage,
  type ReaderSection,
  toInjectedScript,
  type WebToNativeMessage,
} from '../engine/protocol';
import { buildShellHtml } from '../engine/shell';
import useTimeTracking from './useTimeTracking';
import { useTtsSession } from './useTtsSession';
import { EMPTY_READER_SEARCH_RESULT, type ReaderSearchResult } from '../types';
import { loadChapterHtml, readPluginFile } from '../utils/chapterContent';
import { readerCssVariables } from '../utils/cssVariables';
import { loadAdjacentPage } from '../utils/pages';
import { startFraction, writePosition } from '../utils/positions';
import {
  MAX_AUTO_SCROLL_INTERVAL,
  MIN_AUTO_SCROLL_INTERVAL,
} from '@utils/constants/readerConstants';
import useCustomCode from '../components/Hooks/useCustomCode';
import useTextModifications from '../components/Hooks/useTextModifications';

export interface ReaderPosition {
  chapterId: number;
  fraction: number;
  endFraction: number;
  page?: number;
  pages?: number;
  atStart: boolean;
  atEnd: boolean;
}

const RTL_LANGUAGES = new Set(['Arabic', 'Hebrew', 'Persian', 'Urdu']);

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = RNDeviceInfo
  ? new NativeEventEmitter(RNDeviceInfo)
  : undefined;

const toSections = (chapters: readonly ChapterInfo[]): ReaderSection[] =>
  chapters.map(chapter => ({ id: chapter.id, name: chapter.name }));

const toNativeTtsSettings = (
  settings: ReturnType<typeof useChapterReaderSettings>['tts'],
): TtsSettings => ({
  engineName: settings?.engine?.name,
  voiceIdentifier: settings?.voice?.identifier,
  rate: settings?.rate ?? 1,
  pitch: settings?.pitch ?? 1,
});

export default function useChapter(
  webViewRef: RefObject<WebView<object> | null>,
  novel: NovelInfo,
  initialChapter: ChapterInfo,
) {
  const {
    setLastRead,
    markChapterRead,
    updateChapterProgress,
    increaseTimeSpent,
    chapterTextCache,
  } = useNovelActions();
  const novelSettings = useNovelValue('novelSettings');
  const readerSettings = useChapterReaderSettings();
  const generalSettings = useChapterGeneralSettings();
  const { incognitoMode = false } = useLibrarySettings();
  const { timeTrackingEnabled, inactivityTimeoutMs } = useAppSettings();
  const { tracker } = useTracker();
  const { trackedNovel, updateAllTrackedNovels } = useTrackedNovel(novel.id);
  const { setImmersiveMode, showStatusAndNavBar } = useFullscreenMode();
  const plugin = getPlugin(novel.pluginId);
  const excludedScanlators = novelSettings?.excludedScanlators;

  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [chapter, setChapter] = useState(initialChapter);
  const [position, setPosition] = useState<ReaderPosition>();
  const [error, setError] = useState<string>();
  const [hidden, setHidden] = useState(true);
  const [searchResult, setSearchResult] = useState<ReaderSearchResult>(
    EMPTY_READER_SEARCH_RESULT,
  );
  const [selection, setSelection] = useState<string>();
  const [pluginCode, setPluginCode] = useState<{ css: string; js: string }>();

  const chaptersRef = useRef<ChapterInfo[]>([]);
  const chapterRef = useRef(initialChapter);
  const hiddenRef = useRef(true);
  const readyRef = useRef(false);
  const openedRef = useRef(false);
  const markedReadRef = useRef(new Set<number>());
  const lastEndRef = useRef(0);
  const savedProgressRef = useRef(new Map<number, number>());
  const searchQueryRef = useRef('');
  const ttsAutoStartRef = useRef(false);
  const loadingPageRef = useRef(false);

  useEffect(() => {
    chapterRef.current = chapter;
  }, [chapter]);

  const send = useCallback(
    (message: NativeToWebMessage) => {
      webViewRef.current?.injectJavaScript(toInjectedScript(message));
    },
    [webViewRef],
  );

  const { onUserInteraction, isTTSReadingRef } = useTimeTracking(
    chapter.id,
    incognitoMode,
    inactivityTimeoutMs,
    timeTrackingEnabled,
    increaseTimeSpent,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getReaderChapters(novel.id, excludedScanlators),
      readPluginFile(`${PLUGIN_STORAGE}/${novel.pluginId}/custom.css`),
      readPluginFile(`${PLUGIN_STORAGE}/${novel.pluginId}/custom.js`),
    ])
      .then(([list, css, js]) => {
        if (cancelled) {
          return;
        }
        const found = list.some(item => item.id === initialChapter.id);
        const book = found ? list : [initialChapter];
        chaptersRef.current = book;
        setChapters(book);
        setPluginCode({ css, js });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
    // The book is built once per reader session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { customJS, customCSS } = useCustomCode(readerSettings);
  const theme = useTheme();
  const preferences = useMemo(
    () =>
      toReaderPreferences(
        readerSettings,
        generalSettings,
        [customCSS, pluginCode?.css ?? ''].filter(Boolean).join('\n'),
        readerCssVariables(readerSettings, theme),
      ),
    [customCSS, generalSettings, pluginCode?.css, readerSettings, theme],
  );
  const preferencesRef = useRef(preferences);

  const assetsUri = getReaderAssetsUri();
  // Built once: a new source would reload the page and lose the position.
  const [shellHtml] = useState(() =>
    buildShellHtml(assetsUri, readerSettings.theme),
  );

  const openBook = useCallback(
    (book: readonly ChapterInfo[], target: ChapterInfo, fraction: number) => {
      openedRef.current = true;
      void getBatteryLevel()
        .catch(() => -1)
        .then(level =>
          send({
            type: 'open',
            novelName: novel.name,
            novelId: novel.id,
            pluginId: novel.pluginId,
            sections: toSections(book),
            start: { chapterId: target.id, fraction },
            preferences: preferencesRef.current,
            assetsUri: READER_FONTS_URI,
            dir: RTL_LANGUAGES.has(plugin?.lang ?? '') ? 'rtl' : 'ltr',
            customJs: customJS,
            pluginJs: pluginCode?.js ?? '',
            battery: level,
            strings: {
              retry: getString('common.retry'),
              finished: getString('readerScreen.finished'),
              nextChapter: getString('readerScreen.nextChapter', {
                name: '%{name}',
              }),
              noNextChapter: getString('readerScreen.noNextChapter'),
            },
          }),
        );
    },
    [
      novel.id,
      novel.name,
      novel.pluginId,
      plugin?.lang,
      pluginCode?.js,
      customJS,
      send,
    ],
  );

  const tryOpen = useCallback(() => {
    const book = chaptersRef.current;
    if (!readyRef.current || openedRef.current || !book.length || !pluginCode) {
      return;
    }
    // The stored row: the navigation param can be stale.
    const start =
      book.find(item => item.id === chapterRef.current.id) ??
      chapterRef.current;
    openBook(book, start, startFraction(start.id, start.progress));
  }, [openBook, pluginCode]);

  useEffect(tryOpen, [chapters, pluginCode, tryOpen]);

  useEffect(() => {
    preferencesRef.current = preferences;
    if (openedRef.current) {
      send({ type: 'preferences', preferences });
    }
  }, [preferences, send]);

  const updateTracker = useCallback(
    (read: ChapterInfo) => {
      const chapterNumber = parseChapterNumber(novel.name, read.name);
      if (tracker && trackedNovel && chapterNumber > trackedNovel.progress) {
        updateAllTrackedNovels({ progress: chapterNumber });
      }
    },
    [novel.name, trackedNovel, tracker, updateAllTrackedNovels],
  );

  const markRead = useCallback(
    (read: ChapterInfo) => {
      // Progress is reported repeatedly while reading the end of a chapter;
      // marking it read (and pushing it to the tracker, which is a network
      // call) only has to happen once.
      if (incognitoMode || markedReadRef.current.has(read.id)) {
        return;
      }
      markedReadRef.current.add(read.id);
      markChapterRead(read.id);
      updateTracker(read);
    },
    [incognitoMode, markChapterRead, updateTracker],
  );

  // Saved on every stop; with pages only when it grows.
  const saveProgress = useCallback(
    (read: ChapterInfo, endFraction: number, paged: boolean) => {
      if (incognitoMode) {
        return;
      }
      const percentage = Math.floor(endFraction * 100);
      const saved = savedProgressRef.current.get(read.id) ?? read.progress ?? 0;
      if (paged && percentage <= saved) {
        return;
      }
      savedProgressRef.current.set(read.id, percentage);
      updateChapterProgress(read.id, percentage > 100 ? 100 : percentage);
      if (percentage >= 97) {
        markRead(read);
      }
    },
    [incognitoMode, markRead, updateChapterProgress],
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

  const hideHeader = useCallback(() => {
    const next = !hiddenRef.current;
    // Updated synchronously so two taps within the same tick cannot both
    // read the pre-toggle value.
    hiddenRef.current = next;
    if (next) {
      setImmersiveMode();
    } else {
      showStatusAndNavBar();
    }
    setHidden(next);
  }, [setImmersiveMode, showStatusAndNavBar]);

  const indexOf = (id: number) =>
    chaptersRef.current.findIndex(item => item.id === id);

  const openChapter = useCallback(
    (target: ChapterInfo, fraction?: number) => {
      const at = fraction ?? startFraction(target.id, target.progress);
      if (indexOf(target.id) !== -1) {
        send({
          type: 'go-to',
          location: { chapterId: target.id, fraction: at },
        });
        return;
      }
      // Outside the stored book (another source page): rebuild it.
      void getReaderChapters(novel.id, excludedScanlators).then(list => {
        const book = list.some(item => item.id === target.id) ? list : [target];
        chaptersRef.current = book;
        setChapters(book);
        openBook(book, target, at);
      });
    },
    [excludedScanlators, novel.id, openBook, send],
  );

  const neighbours = useMemo(() => {
    const index = chapters.findIndex(item => item.id === chapter.id);
    return {
      nextChapter: index === -1 ? undefined : chapters[index + 1],
      prevChapter: index > 0 ? chapters[index - 1] : undefined,
    };
  }, [chapter.id, chapters]);

  const navigateChapter = useCallback(
    (direction: 'NEXT' | 'PREV') => {
      const target =
        direction === 'NEXT' ? neighbours.nextChapter : neighbours.prevChapter;
      if (target) {
        // Read on from the start: a glimpse of it from the end of this one
        // can have saved a position part way in.
        openChapter(target, direction === 'NEXT' ? 0 : undefined);
      } else {
        send({
          type: 'turn',
          direction: direction === 'NEXT' ? 'next' : 'prev',
        });
      }
    },
    [neighbours, openChapter, send],
  );

  const seek = useCallback(
    (fraction: number) =>
      send({
        type: 'go-to',
        location: { chapterId: chapterRef.current.id, fraction },
      }),
    [send],
  );

  const turnPage = useCallback(
    (direction: 'next' | 'prev') => send({ type: 'turn', direction }),
    [send],
  );

  const extendBook = useCallback(
    async (direction: 'next' | 'prev', turnAfter: boolean) => {
      if (loadingPageRef.current) {
        return;
      }
      loadingPageRef.current = true;
      try {
        const current = chaptersRef.current;
        const list = await loadAdjacentPage(
          novel,
          current,
          direction,
          excludedScanlators,
        );
        if (!list) {
          if (turnAfter) {
            showToast(
              getString(
                direction === 'next'
                  ? 'readerScreen.noNextChapter'
                  : 'readerScreen.noPreviousChapter',
              ),
            );
          }
          return;
        }
        chaptersRef.current = list;
        setChapters(list);
        if (direction === 'next') {
          const known = new Set(current.map(item => item.id));
          send({
            type: 'append-sections',
            sections: toSections(list.filter(item => !known.has(item.id))),
          });
          if (turnAfter) {
            send({ type: 'turn', direction: 'next' });
          }
        } else {
          // Sections can only be appended; earlier chapters reopen the book
          // at the end of the chapter just before.
          const firstIndex = list.findIndex(item => item.id === current[0]?.id);
          const target =
            list[Math.max(0, firstIndex - 1)] ?? chapterRef.current;
          openBook(list, target, turnAfter ? 1 : 0);
        }
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : String(cause));
      } finally {
        loadingPageRef.current = false;
      }
    },
    [excludedScanlators, novel, openBook, send],
  );

  const refetch = useCallback(() => {
    chapterTextCache.remove(chapterRef.current.id);
    setError(undefined);
    send({ type: 'reload-section', chapterId: chapterRef.current.id });
  }, [chapterTextCache, send]);

  const tts = useTtsSession();
  const {
    command: ttsCommand,
    loadAndPlay,
    progress: ttsProgress,
    state: ttsState,
    updateSettings: updateTtsSettings,
  } = tts;

  const startTts = useCallback(() => send({ type: 'tts-start' }), [send]);
  const targetTts = useCallback(
    (point?: { x: number; y: number }) =>
      send(
        point ? { type: 'tts-target', ...point } : { type: 'tts-target-clear' },
      ),
    [send],
  );
  const startTtsAt = useCallback(
    (point: { x: number; y: number }) =>
      send({ type: 'tts-start-at', ...point }),
    [send],
  );
  const stopTts = useCallback(() => {
    ttsAutoStartRef.current = false;
    ttsCommand('stop');
    send({ type: 'tts-stop' });
  }, [send, ttsCommand]);

  useEffect(() => {
    isTTSReadingRef.current = ttsState === 'playing';
  }, [isTTSReadingRef, ttsState]);

  useEffect(() => {
    if (ttsProgress.total > 0) {
      send({ type: 'tts-highlight', index: ttsProgress.index });
    }
  }, [send, ttsProgress]);

  // Opening the next chapter changes the neighbours while the state still
  // reads completed; each finished queue advances only once.
  const ttsCompletionHandledRef = useRef(false);
  useEffect(() => {
    if (ttsState !== 'completed') {
      ttsCompletionHandledRef.current = false;
      return;
    }
    if (ttsCompletionHandledRef.current) {
      return;
    }
    ttsCompletionHandledRef.current = true;
    send({ type: 'tts-stop' });
    const next = neighbours.nextChapter;
    if (readerSettings.tts?.autoPageAdvance && next) {
      ttsAutoStartRef.current = true;
      openChapter(next);
    }
  }, [
    neighbours.nextChapter,
    openChapter,
    readerSettings.tts?.autoPageAdvance,
    send,
    ttsState,
  ]);

  const ttsSettingsKey = JSON.stringify(
    toNativeTtsSettings(readerSettings.tts),
  );
  useEffect(() => {
    updateTtsSettings(JSON.parse(ttsSettingsKey) as TtsSettings);
  }, [ttsSettingsKey, updateTtsSettings]);

  const searchChapter = useCallback(
    (query: string) => {
      searchQueryRef.current = query.trim();
      if (!searchQueryRef.current) {
        send({ type: 'search-clear' });
        setSearchResult(EMPTY_READER_SEARCH_RESULT);
        return;
      }
      send({ type: 'search', query });
    },
    [send],
  );
  const stepSearch = useCallback(
    (direction: 1 | -1) => send({ type: 'search-step', direction }),
    [send],
  );
  const clearSearch = useCallback(() => {
    searchQueryRef.current = '';
    send({ type: 'search-clear' });
    setSearchResult(EMPTY_READER_SEARCH_RESULT);
  }, [send]);

  const clearSelection = useCallback(() => {
    setSelection(undefined);
    send({ type: 'clear-selection' });
  }, [send]);

  const clearSelectionState = useCallback(() => setSelection(undefined), []);
  const { removeText, replaceText } = useTextModifications(
    send,
    clearSelectionState,
  );

  const textRulesRef = useRef({
    remove: readerSettings.removeText,
    replace: readerSettings.replaceText,
  });
  useEffect(() => {
    textRulesRef.current = {
      remove: readerSettings.removeText,
      replace: readerSettings.replaceText,
    };
  }, [readerSettings.removeText, readerSettings.replaceText]);

  // Chapters whose text could not be loaded: scrolling past one does not read it.
  const failedIdsRef = useRef(new Set<number>());

  const deliverSection = useCallback(
    (requestId: number, chapterId: number) => {
      const target =
        chaptersRef.current.find(item => item.id === chapterId) ??
        (chapterId === initialChapter.id ? initialChapter : undefined);
      if (!target) {
        send({ type: 'section-error', requestId, message: 'Unknown chapter' });
        return;
      }
      loadChapterHtml(chapterTextCache, novel, target)
        .then(html => {
          failedIdsRef.current.delete(chapterId);
          send({
            type: 'section-content',
            requestId,
            html: applyTextModifications(
              html,
              textRulesRef.current.remove,
              textRulesRef.current.replace,
            ),
            // Downloaded chapters point at local files; online ones resolve
            // relative links against the source site.
            baseUrl: target.isDownloaded ? undefined : plugin?.site,
          });
        })
        .catch((cause: unknown) => {
          failedIdsRef.current.add(chapterId);
          send({
            type: 'section-error',
            requestId,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        });
    },
    [chapterTextCache, initialChapter, novel, plugin?.site, send],
  );

  const onRelocate = useCallback(
    (message: Extract<WebToNativeMessage, { type: 'relocate' }>) => {
      const list = chaptersRef.current;
      const index = list.findIndex(item => item.id === message.chapterId);
      const visible = list[index];
      if (!visible) {
        return;
      }
      const previous = chapterRef.current;
      if (visible.id !== previous.id) {
        // Scrolling on from the end of the chapter before counts it as read.
        if (
          generalSettings.continuousChapters &&
          index === indexOf(previous.id) + 1 &&
          lastEndRef.current >= 0.9 &&
          !failedIdsRef.current.has(previous.id)
        ) {
          markRead(previous);
        }
        chapterRef.current = visible;
        setChapter(visible);
        if (ttsAutoStartRef.current) {
          ttsAutoStartRef.current = false;
          startTts();
        }
      }
      lastEndRef.current = message.endFraction;
      setPosition(message);
      if (!failedIdsRef.current.has(visible.id)) {
        if (!incognitoMode) {
          writePosition(visible.id, message.fraction);
        }
        saveProgress(visible, message.endFraction, message.pages !== undefined);
      }
      // Keep the next source page ready before the book runs out.
      if (index >= list.length - 2) {
        void extendBook('next', false);
      }
    },
    [
      extendBook,
      generalSettings.continuousChapters,
      incognitoMode,
      markRead,
      saveProgress,
      startTts,
    ],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseWebMessage(event.nativeEvent.data);
      if (!message) {
        return;
      }
      switch (message.type) {
        case 'ready':
          readyRef.current = true;
          openedRef.current = false;
          tryOpen();
          break;
        case 'request-section':
          deliverSection(message.requestId, message.chapterId);
          break;
        case 'relocate':
          onRelocate(message);
          break;
        case 'tap':
          hideHeader();
          break;
        case 'boundary':
          void extendBook(message.direction, true);
          break;
        case 'navigate-chapter':
          navigateChapter(message.direction === 'next' ? 'NEXT' : 'PREV');
          break;
        case 'search-result':
          if (message.query.trim() === searchQueryRef.current) {
            setSearchResult({
              query: message.query,
              current: message.current,
              total: message.total,
              renderedTotal: message.total,
              isTruncated: false,
            });
          }
          break;
        case 'tts-queue': {
          const read = chaptersRef.current.find(
            item => item.id === message.chapterId,
          );
          void loadAndPlay(
            message.utterances,
            0,
            {
              novelName: novel.name,
              chapterName: read?.name ?? chapterRef.current.name,
              coverUri: novel.cover || undefined,
            },
            toNativeTtsSettings(readerSettings.tts),
          );
          break;
        }
        case 'selection':
          setSelection(message.text);
          break;
        case 'selection-cleared':
          setSelection(undefined);
          break;
        case 'open-link':
          void Linking.openURL(message.href);
          break;
        case 'refresh-section':
          chapterTextCache.remove(message.chapterId);
          send({ type: 'reload-section', chapterId: message.chapterId });
          break;
        case 'interaction':
          onUserInteraction();
          break;
        case 'error':
        case 'log':
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(`[reader] ${message.message}`);
          }
          break;
      }
    },
    [
      chapterTextCache,
      deliverSection,
      extendBook,
      navigateChapter,
      hideHeader,
      loadAndPlay,
      novel.cover,
      novel.name,
      onRelocate,
      onUserInteraction,
      readerSettings.tts,
      send,
      tryOpen,
    ],
  );

  const {
    useVolumeButtons: volumeKeys,
    volumeButtonsOffset,
    pageReaderInvertVolumeButtons,
    autoScroll,
    autoScrollInterval,
    autoScrollSmooth = false,
    pageReader,
  } = generalSettings;
  useEffect(() => {
    NativeVolumeButtonListener.setActive(volumeKeys);
    return () => NativeVolumeButtonListener.setActive(false);
  }, [volumeKeys]);
  const onVolumeKey = (key: 'up' | 'down') => {
    if (pageReader) {
      const forward = (key === 'down') !== pageReaderInvertVolumeButtons;
      send({ type: 'turn', direction: forward ? 'next' : 'prev' });
      return;
    }
    send({
      type: 'turn',
      direction: key === 'down' ? 'next' : 'prev',
      distance:
        volumeButtonsOffset ??
        Math.round(Dimensions.get('window').height * 0.75),
    });
  };
  useEventListener(NativeVolumeButtonListener, 'VolumeUp', () =>
    onVolumeKey('up'),
  );
  useEventListener(NativeVolumeButtonListener, 'VolumeDown', () =>
    onVolumeKey('down'),
  );

  useEffect(() => {
    const subscription = deviceInfoEmitter?.addListener(
      'RNDeviceInfo_batteryLevelDidChange',
      (level: number) => send({ type: 'battery', level }),
    );
    return () => subscription?.remove();
  }, [send]);

  // Starts once the first chapter is on screen.
  // Auto-scroll is a scrolling feature; pages turn by taps and the volume keys.
  const scrollInterval =
    autoScroll && !pageReader
      ? Math.min(
          MAX_AUTO_SCROLL_INTERVAL,
          Math.max(MIN_AUTO_SCROLL_INTERVAL, autoScrollInterval),
        )
      : 0;
  // A screen per interval; the interval alone sets the speed.
  const scrollDistance = Math.round(Dimensions.get('window').height);
  const onScreen = position !== undefined;
  useEffect(() => {
    if (onScreen) {
      send({
        type: 'auto-scroll',
        interval: scrollInterval,
        distance: scrollDistance,
        smooth: autoScrollSmooth,
      });
    }
  }, [onScreen, scrollInterval, scrollDistance, autoScrollSmooth, send]);

  return {
    hidden,
    webView: {
      source: { html: shellHtml },
      onMessage,
    },
    session: {
      novel,
      chapter,
      chapters,
      ...neighbours,
      position,
      loading: position === undefined && !error,
      error,
      hideHeader,
      openChapter,
      navigateChapter,
      seek,
      turnPage,
      refetch,
      search: {
        result: searchResult,
        run: searchChapter,
        step: stepSearch,
        clear: clearSearch,
      },
      tts: {
        state: ttsState,
        progress: ttsProgress,
        error: tts.error,
        start: startTts,
        startAt: startTtsAt,
        target: targetTts,
        stop: stopTts,
        command: ttsCommand,
      },
      selection: {
        text: selection,
        clear: clearSelection,
        remove: removeText,
        replace: replaceText,
      },
    },
  };
}

export type ReaderSession = ReturnType<typeof useChapter>['session'];
