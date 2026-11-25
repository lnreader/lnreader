import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  StatusBar,
  StyleSheet,
} from 'react-native';
import WebView from 'react-native-webview';
import * as Linking from 'expo-linking';
import color from 'color';

import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

import { INSTALLED_PLUGINS_KEY, getPlugin } from '@plugins/pluginManager';
import type { Plugin, PluginItem } from '@plugins/types';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  CHAPTER_READER_SETTINGS,
  ChapterGeneralSettings,
  ChapterReaderSettings,
  initialChapterGeneralSettings,
  initialChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import { getBatteryLevel } from 'react-native-device-info';
import { PLUGIN_STORAGE } from '@utils/Storages';
import { useChapterContext } from '../ChapterContext';
import { ReaderSearchResult } from '../types';
import { useTtsSession } from '../hooks/useTtsSession';
import useNovelLinkNavigation from '../hooks/useNovelLinkNavigation';
import type { TtsSettings } from '@modules/nitro-tts';
import { ChapterInfo } from '@database/types';
import { Dialog } from '@components/Dialog';
import { TextInput } from 'react-native-paper';
import useCustomCode from './Hooks/useCustomCode';
import useTextModifications from './Hooks/useTextModifications';
import { buildTtsQueueFromHtml } from '../utils/ttsQueue';
import { applyTextModifications } from '@utils/customCode';
import TtsSleepTimerDialog from './TtsSleepTimerDialog';
import {
  ChapterPayload,
  ReaderShellKey,
  buildChapterPayload,
  buildSetChapterScript,
  buildShellKey,
  isSameShellKey,
  measureChapterShown,
  serializeForScript,
  shouldReloadShell,
} from '../utils/readerShell';
import { buildReaderChromeScript } from '../utils/buildReaderChromeScript';
import { createReaderLinkHandlers } from '../utils/handleReaderLink';

export type WebViewPostEvent = {
  type: string;
  data?: unknown;
  chapterId?: number;
  autoStartTTS?: boolean;
  index?: number;
  total?: number;
};

type WebViewReaderProps = {
  hiddenRef: React.RefObject<boolean>;
  searchVisibleRef: React.RefObject<boolean>;
  onPress(): void;
  onTouchStart?(): void;
  onSearchResult(result: ReaderSearchResult): void;
  searchTextRef: React.MutableRefObject<string>;
};

const onLogMessage = (payload: { nativeEvent: { data: string } }) => {
  const dataPayload = JSON.parse(payload.nativeEvent.data);
  if (dataPayload) {
    if (dataPayload.type === 'console') {
      /* eslint-disable no-console */
      console.info(`[Console] ${JSON.stringify(dataPayload.msg, null, 2)}`);
    }
  }
};

/** Checks whether two TTS settings objects are equal */
const areTTSSettingsEqual = (
  a: ChapterReaderSettings['tts'],
  b: ChapterReaderSettings['tts'],
) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.rate === b.rate &&
    a.pitch === b.pitch &&
    a.autoPageAdvance === b.autoPageAdvance &&
    a.scrollToTop === b.scrollToTop &&
    a.voice?.identifier === b.voice?.identifier &&
    a.engine?.name === b.engine?.name
  );
};

const toNativeTtsSettings = (
  settings: ChapterReaderSettings['tts'],
): TtsSettings => ({
  engineName: settings?.engine?.name,
  voiceIdentifier: settings?.voice?.identifier,
  rate: settings?.rate ?? 1,
  pitch: settings?.pitch ?? 1,
});

/**
 * The adjacent chapters are resolved after the chapter itself is on screen, so
 * they are pushed into the loaded page instead of being baked into the HTML –
 * rebuilding the HTML would reload the WebView and lose the reading position.
 */
const buildAdjacentChapterScript = (
  chapterName?: string,
  nextChapter?: ChapterInfo,
  prevChapter?: ChapterInfo,
) => `
  window.reader?.setAdjacentChapters?.(${JSON.stringify({
    nextChapter,
    prevChapter,
    strings: {
      // Infinite scrolling changes the chapter being read without rebuilding
      // the document the original string was baked into.
      ...(chapterName && {
        finished:
          getString('readerScreen.finished') + ': ' + chapterName.trim(),
      }),
      nextChapter: getString('readerScreen.nextChapter', {
        name: nextChapter?.name,
      }),
    },
  })});
  true;
`;

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter<{
  RNDeviceInfo_batteryLevelDidChange: [number];
}>(RNDeviceInfo);

/**
 * Last level seen, so a chapter can be rendered without the synchronous native
 * call the sync variant of this API performs. It is refreshed asynchronously
 * and pushed into the page, which also happens on every battery change event.
 */
let lastKnownBatteryLevel = 0;

const assetsUriPrefix = __DEV__
  ? 'http://localhost:8081/assets'
  : 'file:///android_asset';

/** How long a chapter swap may take before the page is reloaded instead. */
export const CHAPTER_SWAP_TIMEOUT_MS = 5000;

const readReaderSettings = (): ChapterReaderSettings => ({
  ...initialChapterReaderSettings,
  ...getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS),
});

const readGeneralSettings = (): ChapterGeneralSettings => ({
  ...initialChapterGeneralSettings,
  ...getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS),
});

const hasPluginCustomJS = (pluginId?: string) =>
  !!pluginId &&
  !!getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS_KEY)?.find(
    item => item.id === pluginId,
  )?.customJS;

/** What the loaded reader page was built from. */
type ReaderShell = {
  key: ReaderShellKey;
  /** The chapter the page was loaded with; later ones are swapped in. */
  payload: ChapterPayload;
  plugin?: Plugin;
  theme: ReturnType<typeof useTheme>;
  readerDir: 'ltr' | 'rtl';
  customJS: string;
  customCSS: string;
  readerSettings: ChapterReaderSettings;
  generalSettings: ChapterGeneralSettings;
  batteryLevel: number;
};

const WebViewReader: React.FC<WebViewReaderProps> = ({
  onPress,
  onTouchStart,
  onSearchResult,
  searchTextRef,
  searchVisibleRef,
  hiddenRef,
}) => {
  const {
    novel,
    chapter,
    documentChapter,
    chapterText: html,
    navigateChapter,
    saveProgress,
    activateChapter,
    loadChapterAfter,
    getRebuildTarget,
    dropChapters,
    nextChapter,
    prevChapter,
    webViewRef,
    onUserInteraction,
    isTTSReadingRef,
    refetch,
  } = useChapterContext();
  const theme = useTheme();
  const openNovelLink = useNovelLinkNavigation(novel);
  // Custom code snippets apply from the next chapter on, like before chapters
  // were swapped into the loaded page.
  const chapterReaderSettings = useMemo(
    () => readReaderSettings(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentChapter.id],
  );

  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = useMemo(
    () => hasPluginCustomJS(plugin?.id),
    // Re-checked per chapter, as a plugin update can add or drop its script.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plugin?.id, documentChapter.id],
  );
  const nextChapterScreenVisible = useRef<boolean>(false);
  const autoStartTTSRef = useRef<boolean>(false);
  const ttsChapterTransitionRef = useRef(false);
  const ttsTransitionInFlightRef = useRef(false);
  const ttsTransitionGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const activeChapterIdRef = useRef(chapter.id);
  const adjacentChapterScriptRef = useRef(buildAdjacentChapterScript());
  const {
    command: runTtsCommand,
    cancelSleepTimer,
    loadQueue,
    loadAndPlay,
    progress: ttsProgress,
    seekTo: seekTts,
    state: ttsState,
    setSleepTimer,
    sleepTimer,
    updateSettings: updateTtsSettings,
  } = useTtsSession();

  const cancelTtsTransition = useCallback(() => {
    ttsTransitionGenerationRef.current += 1;
    ttsTransitionInFlightRef.current = false;
    ttsChapterTransitionRef.current = false;
    autoStartTTSRef.current = false;
  }, []);

  const stopTts = useCallback(() => {
    cancelTtsTransition();
    runTtsCommand('stop');
  }, [cancelTtsTransition, runTtsCommand]);

  const linkHandlers = () =>
    createReaderLinkHandlers({
      openNovel: url => {
        if (!openNovelLink(url)) {
          return false;
        }
        // The linked novel covers this reader, so its speech stops.
        stopTts();
        return true;
      },
      openExternal: url => {
        void Linking.openURL(url).catch(() => undefined);
      },
      inject: script => webViewRef.current?.injectJavaScript(script),
      refresh: refetch,
    });

  useEffect(
    () => () => {
      mountedRef.current = false;
      cancelTtsTransition();
    },
    [cancelTtsTransition],
  );

  const [sleepTimerDialogVisible, setSleepTimerDialogVisible] = useState(false);

  const { customJS, customCSS } = useCustomCode(chapterReaderSettings);

  const {
    html: processedHtml,
    pendingTextAction,
    replacementText,
    setReplacementText,
    confirmTextAction,
    dismissTextAction,
    eventTextAction,
  } = useTextModifications(html, webViewRef);
  const isRemovingText = pendingTextAction?.type === 'remove';

  const [readerSettings, setReaderSettings] = useState(
    () =>
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
      initialChapterReaderSettings,
  );

  const readerSettingsRef = useRef<ChapterReaderSettings>(readerSettings);

  useEffect(() => {
    readerSettingsRef.current = readerSettings;
  }, [readerSettings]);

  useEffect(() => {
    isTTSReadingRef.current = ttsState === 'playing';
    if (ttsState === 'idle' || ttsState === 'error') {
      cancelTtsTransition();
    }
    webViewRef.current?.injectJavaScript(`
      window.tts?.setPlaybackState?.(${JSON.stringify(ttsState)});
      true;
    `);
    if (ttsState === 'completed') {
      webViewRef.current?.injectJavaScript('window.tts?.complete?.(); true;');
    }
  }, [cancelTtsTransition, isTTSReadingRef, ttsState, webViewRef]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(`
      window.tts?.setSleepTimerState?.(${JSON.stringify(sleepTimer)});
      true;
    `);
  }, [sleepTimer, webViewRef]);

  useEffect(() => {
    if (ttsState !== 'loading') {
      return;
    }
    if (readerSettingsRef.current.tts?.autoPageAdvance !== true) {
      stopTts();
      return;
    }
    if (ttsTransitionInFlightRef.current) return;

    ttsTransitionInFlightRef.current = true;
    const transitionGeneration = ++ttsTransitionGenerationRef.current;
    const timerExpiredAtBoundary = sleepTimer.expired;
    const isTransitionActive = () =>
      mountedRef.current &&
      transitionGeneration === ttsTransitionGenerationRef.current &&
      readerSettingsRef.current.tts?.autoPageAdvance === true;

    void (async () => {
      try {
        ttsChapterTransitionRef.current = true;
        const loaded = await navigateChapter('NEXT', isTransitionActive);
        if (!isTransitionActive()) {
          ttsChapterTransitionRef.current = false;
          return;
        }
        if (!loaded) {
          ttsChapterTransitionRef.current = false;
          stopTts();
          return;
        }

        const settings = readerSettingsRef.current;
        const backgroundHtml = applyTextModifications(
          loaded.html,
          settings.removeText,
          settings.replaceText,
        );
        const queue = buildTtsQueueFromHtml(backgroundHtml);
        if (queue.length === 0) {
          stopTts();
          return;
        }

        const queueLoaded = await loadQueue(
          queue,
          0,
          {
            novelName: novel?.name || 'Unknown',
            chapterName: loaded.chapter.name,
            coverUri: novel?.cover || undefined,
          },
          toNativeTtsSettings(settings.tts),
          {
            autoplay: !timerExpiredAtBoundary,
            expectContinuation: settings.tts?.autoPageAdvance === true,
            canContinue: isTransitionActive,
          },
        );
        if (!isTransitionActive()) {
          return;
        }
        if (!queueLoaded) {
          stopTts();
          return;
        }
        if (timerExpiredAtBoundary) {
          cancelSleepTimer();
        }
      } catch {
        stopTts();
      } finally {
        if (transitionGeneration === ttsTransitionGenerationRef.current) {
          ttsTransitionInFlightRef.current = false;
        }
      }
    })();
  }, [
    cancelSleepTimer,
    loadQueue,
    navigateChapter,
    novel?.cover,
    novel?.name,
    sleepTimer.expired,
    stopTts,
    ttsState,
  ]);

  useEffect(() => {
    if (
      readerSettings.tts?.autoPageAdvance !== true &&
      ttsTransitionInFlightRef.current
    ) {
      stopTts();
    }
  }, [readerSettings.tts?.autoPageAdvance, stopTts]);

  useEffect(() => {
    if (ttsProgress.total > 0) {
      webViewRef.current?.injectJavaScript(`
        window.tts?.setActiveIndex?.(${ttsProgress.index});
        true;
      `);
    }
  }, [ttsProgress, webViewRef]);

  useEffect(() => {
    if (activeChapterIdRef.current !== chapter.id) {
      activeChapterIdRef.current = chapter.id;
      if (ttsChapterTransitionRef.current) {
        ttsChapterTransitionRef.current = false;
      } else {
        runTtsCommand('stop');
      }
    }
  }, [chapter.id, runTtsCommand]);

  useEffect(() => {
    const script = buildAdjacentChapterScript(
      chapter.name,
      nextChapter,
      prevChapter,
    );
    // Kept for onLoadEnd: an update that lands before the document is ready is
    // dropped by the WebView, so it is replayed once the page has loaded.
    adjacentChapterScriptRef.current = script;
    webViewRef.current?.injectJavaScript(script);
  }, [chapter.name, nextChapter, prevChapter, webViewRef]);

  useEffect(() => {
    const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
      switch (key) {
        case CHAPTER_READER_SETTINGS: {
          // Update reader settings
          const newReaderSettings =
            getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
            initialChapterReaderSettings;
          setReaderSettings(newReaderSettings);
          if (
            !areTTSSettingsEqual(
              readerSettingsRef.current.tts,
              newReaderSettings.tts,
            )
          ) {
            updateTtsSettings(toNativeTtsSettings(newReaderSettings.tts));
          }
          // Update WebView settings
          webViewRef.current?.injectJavaScript(
            `
            reader.readerSettings.val = ${JSON.stringify(newReaderSettings)}
            `,
          );
          break;
        }
        case CHAPTER_GENERAL_SETTINGS: {
          const newGeneralSettings =
            getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) ||
            initialChapterGeneralSettings;
          webViewRef.current?.injectJavaScript(
            `reader.generalSettings.val = ${JSON.stringify(
              newGeneralSettings,
            )}`,
          );
          break;
        }
      }
    });

    const subscription = deviceInfoEmitter.addListener(
      'RNDeviceInfo_batteryLevelDidChange',
      (level: number) => {
        lastKnownBatteryLevel = level;
        webViewRef.current?.injectJavaScript(
          `reader.batteryLevel.val = ${level}`,
        );
      },
    );

    getBatteryLevel().then(level => {
      lastKnownBatteryLevel = level;
      webViewRef.current?.injectJavaScript(
        `if (window.reader?.batteryLevel) {
          window.reader.batteryLevel.val = ${level};
        }`,
      );
    });

    return () => {
      subscription.remove();
      mmkvListener.remove();
    };
  }, [updateTtsSettings, webViewRef]);
  const isRTL = plugin?.lang === 'Arabic' || plugin?.lang === 'Hebrew';
  const readerDir = isRTL ? 'rtl' : 'ltr';

  const shellKey = useMemo(
    () =>
      buildShellKey({
        plugin,
        isDownloaded: documentChapter.isDownloaded,
        pluginCustomJS,
        readerDir,
        theme,
        customJS,
        customCSS,
      }),
    [
      documentChapter.isDownloaded,
      customCSS,
      customJS,
      plugin,
      pluginCustomJS,
      readerDir,
      theme,
    ],
  );

  const createShell = (payload: ChapterPayload): ReaderShell => ({
    key: shellKey,
    payload,
    plugin,
    theme,
    readerDir,
    customJS,
    customCSS,
    readerSettings: readReaderSettings(),
    generalSettings: readGeneralSettings(),
    batteryLevel: lastKnownBatteryLevel,
  });

  const [shell, setShell] = useState(() =>
    createShell(
      buildChapterPayload({
        chapter: documentChapter,
        novel,
        html: processedHtml,
        nextChapterScreenVisible: false,
      }),
    ),
  );
  /** Set once the page has loaded; injected scripts are dropped before that. */
  const shellReadyRef = useRef(false);
  const displayedChapterRef = useRef({
    chapter: documentChapter,
    html: processedHtml,
  });
  const pendingSwapRef = useRef<{
    chapterId: number;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);
  /** Bumped when a swap fails, to reload the page with the chapter instead. */
  const [failedSwaps, setFailedSwaps] = useState(0);
  const handledFailedSwapsRef = useRef(0);

  const clearPendingSwap = useCallback(() => {
    if (pendingSwapRef.current) {
      clearTimeout(pendingSwapRef.current.timeout);
      pendingSwapRef.current = null;
    }
  }, []);

  useEffect(() => clearPendingSwap, [clearPendingSwap]);

  /**
   * Shows a new chapter by swapping it into the loaded page, and only loads a
   * new page when something the page was built from has changed, or the swap
   * did not work out.
   */
  useEffect(() => {
    const displayed = displayedChapterRef.current;
    // Compared by identity: returning to the chapter infinite scrolling moved
    // on from must still replace the chapters appended below it.
    const chapterChanged =
      displayed.chapter !== documentChapter || displayed.html !== processedHtml;
    const swapFailed = failedSwaps !== handledFailedSwapsRef.current;
    handledFailedSwapsRef.current = failedSwaps;

    let reload: boolean;
    if (swapFailed) {
      reload = true;
    } else if (chapterChanged) {
      reload = shouldReloadShell(shell.key, shellKey, {
        shellReady: shellReadyRef.current,
      });
    } else {
      reload = !isSameShellKey(shell.key, shellKey);
    }
    if (!chapterChanged && !reload) {
      return;
    }

    const swapPayload = buildChapterPayload({
      chapter: documentChapter,
      novel,
      html: processedHtml,
      nextChapterScreenVisible: nextChapterScreenVisible.current,
    });
    displayedChapterRef.current = {
      chapter: documentChapter,
      html: processedHtml,
    };
    clearPendingSwap();

    if (reload) {
      // Infinite scrolling may have carried the reader past the chapter the
      // page was built for, so the new page starts from the chapter being
      // read, at the progress reached so far.
      const rebuildTarget = getRebuildTarget();
      const payload =
        rebuildTarget && rebuildTarget.chapter.id !== documentChapter.id
          ? buildChapterPayload({
              chapter: rebuildTarget.chapter,
              novel,
              html: applyTextModifications(
                rebuildTarget.html,
                readerSettingsRef.current.removeText,
                readerSettingsRef.current.replaceText,
              ),
              nextChapterScreenVisible: nextChapterScreenVisible.current,
            })
          : rebuildTarget
          ? { ...swapPayload, chapter: rebuildTarget.chapter }
          : swapPayload;
      shellReadyRef.current = false;
      setShell(createShell(payload));
      return;
    }

    const chapterId = documentChapter.id;
    pendingSwapRef.current = {
      chapterId,
      timeout: setTimeout(() => {
        if (pendingSwapRef.current?.chapterId === chapterId) {
          pendingSwapRef.current = null;
          setFailedSwaps(count => count + 1);
        }
      }, CHAPTER_SWAP_TIMEOUT_MS),
    };
    webViewRef.current?.injectJavaScript(buildSetChapterScript(swapPayload));
    // `createShell` only reads values that are dependencies already.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentChapter,
    getRebuildTarget,
    clearPendingSwap,
    failedSwaps,
    novel,
    processedHtml,
    shell.key,
    shellKey,
    webViewRef,
  ]);

  /**
   * Builds the reader page. Handing the WebView a different `source` reloads
   * the page, so this depends on the shell alone: chapters are swapped in with
   * `reader.setChapter`, and settings pushed with `injectJavaScript`.
   */
  const source = useMemo(() => {
    const {
      payload,
      plugin: shellPlugin,
      theme: shellTheme,
      readerSettings: initialReaderSettings,
      generalSettings: chapterGeneralSettings,
    } = shell;
    const isNextChapterScreenVisible = payload.nextChapterScreenVisible;
    const pluginDir = `file://${PLUGIN_STORAGE}/${shellPlugin?.id}`;
    return {
      baseUrl: shell.key.baseUrl,
      headers: shellPlugin?.imageRequestInit?.headers,
      method: shellPlugin?.imageRequestInit?.method,
      body: shellPlugin?.imageRequestInit?.body,
      html: `
        <!DOCTYPE html>
          <html dir="${shell.readerDir}" class="${
        chapterGeneralSettings.pageReaderDisableAnimation ? 'no-animation' : ''
      }">
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
              <link rel="stylesheet" href="${assetsUriPrefix}/css/index.css">
              <link rel="stylesheet" href="${assetsUriPrefix}/css/pageReader.css">
              <link rel="stylesheet" href="${assetsUriPrefix}/css/toolWrapper.css">
              <link rel="stylesheet" href="${assetsUriPrefix}/css/tts.css">
              <style>
              :root {
                --StatusBar-currentHeight: ${StatusBar.currentHeight}px;
                --readerSettings-theme: ${initialReaderSettings.theme};
                --readerSettings-padding: ${initialReaderSettings.padding}px;
                --readerSettings-textSize: ${initialReaderSettings.textSize}px;
                --readerSettings-textColor: ${initialReaderSettings.textColor};
                --readerSettings-textAlign: ${initialReaderSettings.textAlign};
                --readerSettings-lineHeight: ${
                  initialReaderSettings.lineHeight
                };
                --readerSettings-fontFamily: ${
                  initialReaderSettings.fontFamily
                };
                --theme-primary: ${shellTheme.primary};
                --theme-onPrimary: ${shellTheme.onPrimary};
                --theme-secondary: ${shellTheme.secondary};
                --theme-tertiary: ${shellTheme.tertiary};
                --theme-onTertiary: ${shellTheme.onTertiary};
                --theme-onSecondary: ${shellTheme.onSecondary};
                --theme-surface: ${shellTheme.surface};
                --theme-surface-0-9: ${color(shellTheme.surface)
                  .alpha(0.9)
                  .toString()};
                --theme-onSurface: ${shellTheme.onSurface};
                --theme-surfaceVariant: ${shellTheme.surfaceVariant};
                --theme-onSurfaceVariant: ${shellTheme.onSurfaceVariant};
                --theme-outline: ${shellTheme.outline};
                --theme-outlineVariant: ${shellTheme.outlineVariant};
                --theme-rippleColor: ${shellTheme.rippleColor};
                }
                </style>
                <style id="ln-font">
                @font-face {
                  font-family: ${initialReaderSettings.fontFamily};
                  src: url("file:///android_asset/fonts/${
                    initialReaderSettings.fontFamily
                  }.ttf");
                }
				</style>
              <link rel="stylesheet" href="${pluginDir}/custom.css">
              <style id="ln-custom-css">${shell.customCSS}</style>
            </head>
            <body class="${
              chapterGeneralSettings.pageReader ? 'page-reader' : ''
            } ${
        chapterGeneralSettings.pageReaderDisableAnimation ? 'no-animation' : ''
      }">
              <div class="transition-chapter" style="transform: ${
                isNextChapterScreenVisible
                  ? 'translateX(-100%)'
                  : 'translateX(0%)'
              };
              ${chapterGeneralSettings.pageReader ? '' : 'display: none'}"
              ">${payload.chapter.name}</div>
              <div id="LNReader-chapter">
                ${payload.html}
              </div>
              <div id="reader-ui"></div>
              </body>
              <script>
                var initialPageReaderConfig = ${serializeForScript({
                  nextChapterScreenVisible: isNextChapterScreenVisible,
                })};


                var initialReaderConfig = ${serializeForScript({
                  readerSettings: initialReaderSettings,
                  chapterGeneralSettings,
                  novel: payload.novel,
                  chapter: payload.chapter,
                  batteryLevel: shell.batteryLevel,
                  autoSaveInterval: 2222,
                  DEBUG: __DEV__,
                  strings: payload.strings,
                })}
              </script>
              <script src="${assetsUriPrefix}/js/polyfill-onscrollend.js"></script>
              <script src="${assetsUriPrefix}/js/icons.js"></script>
              <script src="${assetsUriPrefix}/js/van.js"></script>
              <script src="${assetsUriPrefix}/js/text-vibe.js"></script>
              <script src="${assetsUriPrefix}/js/core.js"></script>
              <script src="${assetsUriPrefix}/js/search.js"></script>
              <script src="${assetsUriPrefix}/js/index.js"></script>
              <script src="${assetsUriPrefix}/js/textRemover.js"></script>
              <script src="${pluginDir}/custom.js"></script>
              ${
                shell.customJS
                  ? `<script id="ln-custom-js">
              function fn(lnTarget = document.querySelector('#LNReader-chapter')){
                let html = lnTarget.innerHTML;
                ${shell.customJS}
                lnTarget.innerHTML = html;
              }
              window.lnApplyCustomJS = fn;
              document.addEventListener('DOMContentLoaded', () => fn());
              </script>`
                  : ''
              }
          </html>
          `,
    };
  }, [shell]);

  /**
   * Brings the page up to date with the app once a chapter is on screen,
   * whether the page was just loaded or the chapter swapped into it.
   */
  const afterChapterShown = () => {
    const searchText = searchTextRef.current.trim();
    webViewRef.current?.injectJavaScript(`
      if (window.reader?.batteryLevel) {
        window.reader.batteryLevel.val = ${lastKnownBatteryLevel};
      }
      ${adjacentChapterScriptRef.current}
      window.tts?.setPlaybackState?.(${JSON.stringify(ttsState)});
      window.tts?.setSleepTimerState?.(${JSON.stringify(sleepTimer)});
      ${
        ttsProgress.total > 0
          ? `window.tts?.setActiveIndex?.(${ttsProgress.index});`
          : ''
      }
      ${
        searchText
          ? `window.readerSearch?.search(${JSON.stringify(searchText)});`
          : ''
      }
      true;
    `);

    if (autoStartTTSRef.current) {
      autoStartTTSRef.current = false;
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
        (function() {
          if (window.tts && reader.generalSettings.val.TTSEnable) {
            setTimeout(() => {
              tts.start();
            }, 500);
          }
        })();
      `);
      }, 300);
    }
  };

  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  /**
   * Answers infinite scrolling's request for the chapter after `chapterId`.
   * The answer is dropped if the document was rebuilt in the meantime.
   */
  const appendChapterAfter = async (chapterId: number) => {
    const requestSource = sourceRef.current;
    const inject = (call: string, ...args: unknown[]) => {
      if (sourceRef.current === requestSource) {
        webViewRef.current?.injectJavaScript(
          `window.continuousScroll?.${call}(${args
            .map(arg => JSON.stringify(arg))
            .join(', ')}); true;`,
        );
      }
    };
    try {
      const next = await loadChapterAfter(chapterId);
      if (!next) {
        inject('end', chapterId);
        return;
      }
      const { removeText, replaceText } = readerSettingsRef.current;
      inject('append', {
        afterChapterId: chapterId,
        chapter: next.chapter,
        html: applyTextModifications(next.html, removeText, replaceText),
      });
    } catch (e) {
      inject('fail', chapterId, e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <WebView
        ref={webViewRef}
        onTouchStart={onTouchStart}
        style={{ backgroundColor: readerSettings.theme }}
        allowFileAccess={true}
        originWhitelist={['*']}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        webviewDebuggingEnabled={__DEV__}
        onShouldStartLoadWithRequest={({ url }) =>
          linkHandlers().shouldStartLoad(url)
        }
        // Android sends a target="_blank" link to the browser unless the app
        // handles the new window, so the app sends other links there itself.
        onOpenWindow={({ nativeEvent: { targetUrl } }) => {
          linkHandlers().openWindow(targetUrl);
        }}
        onLoadEnd={() => {
          shellReadyRef.current = true;
          // A reloaded page starts with its controls hidden, so send the
          // app's controls state to it.
          webViewRef.current?.injectJavaScript(
            buildReaderChromeScript(
              hiddenRef.current,
              searchVisibleRef.current,
            ),
          );
          measureChapterShown('reload');
          afterChapterShown();
        }}
        onMessage={(ev: { nativeEvent: { data: string } }) => {
          __DEV__ && onLogMessage(ev);
          const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);
          switch (event.type) {
            case 'link':
              linkHandlers().handlePage(event.data);
              break;
            case 'tts-queue': {
              cancelTtsTransition();
              const payload = event.data as
                | { queue?: unknown; startIndex?: unknown }
                | undefined;
              const queue = Array.isArray(payload?.queue)
                ? payload?.queue.filter(
                    (item): item is string =>
                      typeof item === 'string' && item.trim().length > 0,
                  )
                : [];
              const startIndex =
                typeof payload?.startIndex === 'number'
                  ? payload.startIndex
                  : 0;
              void loadAndPlay(
                queue,
                startIndex,
                {
                  novelName: novel?.name || 'Unknown',
                  chapterName: chapter.name,
                  coverUri: novel?.cover || undefined,
                },
                toNativeTtsSettings(readerSettingsRef.current.tts),
                readerSettingsRef.current.tts?.autoPageAdvance === true,
              );
              break;
            }
            case 'tts-command': {
              if (!event.data || typeof event.data !== 'object') {
                break;
              }
              const data = event.data as {
                command?: unknown;
                index?: unknown;
              };
              switch (data.command) {
                case 'next':
                case 'pause':
                case 'play':
                case 'previous':
                case 'replay':
                  runTtsCommand(data.command);
                  break;
                case 'stop':
                  stopTts();
                  break;
                case 'seekTo':
                  if (typeof data.index === 'number') {
                    seekTts(data.index);
                  }
                  break;
              }
              break;
            }
            case 'tts-sleep-timer':
              setSleepTimerDialogVisible(true);
              break;
            case 'hide':
              onPress();
              break;
            case 'refresh':
              refetch();
              break;
            case 'next':
              cancelTtsTransition();
              nextChapterScreenVisible.current = true;
              if (event.autoStartTTS) {
                autoStartTTSRef.current = true;
              }
              navigateChapter('NEXT');
              break;
            case 'prev':
              cancelTtsTransition();
              if (event.autoStartTTS) {
                autoStartTTSRef.current = true;
              }
              navigateChapter('PREV');
              break;
            case 'save':
              // Saved to the chapter the page names, which infinite scrolling
              // makes different from the current one; ids from a replaced
              // document are unknown to `saveProgress` and ignored.
              if (event.data && typeof event.data === 'number') {
                saveProgress(event.data, event.chapterId);
              }
              break;
            case 'chapter-change':
              if (typeof event.chapterId === 'number') {
                activateChapter(event.chapterId);
              }
              break;
            case 'continuous-next':
              if (typeof event.chapterId === 'number') {
                void appendChapterAfter(event.chapterId);
              }
              break;
            case 'chapters-dropped':
              if (Array.isArray(event.data)) {
                dropChapters(
                  event.data.filter(
                    (id): id is number => typeof id === 'number',
                  ),
                );
              }
              break;
            case 'chapter-shown':
              if (
                event.chapterId !== documentChapter.id ||
                pendingSwapRef.current?.chapterId !== documentChapter.id
              ) {
                break;
              }
              clearPendingSwap();
              measureChapterShown('swap');
              afterChapterShown();
              break;
            case 'chapter-swap-failed':
              if (event.chapterId === documentChapter.id) {
                clearPendingSwap();
                setFailedSwaps(count => count + 1);
              }
              break;
            case 'text-action':
              eventTextAction(event);
              break;
            case 'search-result':
              if (event.data && typeof event.data === 'object') {
                const data = event.data as {
                  query?: unknown;
                  current?: unknown;
                  total?: unknown;
                  renderedTotal?: unknown;
                  isTruncated?: unknown;
                };
                const query = typeof data.query === 'string' ? data.query : '';
                if (query !== searchTextRef.current.trim()) {
                  break;
                }
                const total = typeof data.total === 'number' ? data.total : 0;
                onSearchResult({
                  query,
                  current: typeof data.current === 'number' ? data.current : 0,
                  total,
                  renderedTotal:
                    typeof data.renderedTotal === 'number'
                      ? data.renderedTotal
                      : total,
                  isTruncated: data.isTruncated === true,
                });
              }
              break;
            case 'interaction':
              onUserInteraction();
              break;
          }
        }}
        source={source}
      />
      <Dialog.Root
        visible={pendingTextAction !== null}
        onDismiss={dismissTextAction}
      >
        <Dialog.Header>
          <Dialog.Title>
            {getString(
              isRemovingText
                ? 'customCodeSettings.removeText'
                : 'common.replaceText',
            )}
          </Dialog.Title>
          {isRemovingText ? (
            <Dialog.Description>
              {getString('readerSettings.confirmRemoveText')}
            </Dialog.Description>
          ) : null}
        </Dialog.Header>
        <Dialog.Content>
          {isRemovingText ? (
            <Dialog.Description numberOfLines={4}>
              {pendingTextAction.text}
            </Dialog.Description>
          ) : (
            <>
              <TextInput
                label={getString('common.textToReplace')}
                value={pendingTextAction?.text ?? ''}
                editable={false}
                mode="outlined"
                style={styles.textInput}
                theme={{ colors: { background: theme.surface } }}
              />
              <TextInput
                label={getString('common.replaceWith')}
                value={replacementText}
                onChangeText={setReplacementText}
                autoCorrect={false}
                mode="outlined"
                style={styles.textInput}
                theme={{ colors: { background: theme.surface } }}
              />
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Dialog.Action onPress={dismissTextAction}>
            {getString('common.cancel')}
          </Dialog.Action>
          <Dialog.Action
            onPress={confirmTextAction}
            tone={isRemovingText ? 'danger' : 'primary'}
          >
            {getString(
              isRemovingText ? 'common.remove' : 'customCodeSettings.replace',
            )}
          </Dialog.Action>
        </Dialog.Actions>
      </Dialog.Root>
      <TtsSleepTimerDialog
        autoPageAdvance={readerSettings.tts?.autoPageAdvance === true}
        onCancel={cancelSleepTimer}
        onDismiss={() => setSleepTimerDialogVisible(false)}
        onStart={setSleepTimer}
        timer={sleepTimer}
        visible={sleepTimerDialogVisible}
      />
    </>
  );
};

const styles = StyleSheet.create({
  textInput: { marginBottom: 16 },
});

export default memo(WebViewReader);
