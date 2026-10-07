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

import { getPlugin } from '@plugins/pluginManager';
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
import type { TtsSettings } from '@modules/nitro-tts';
import { ChapterInfo } from '@database/types';
import { Dialog } from '@components/Dialog';
import { TextInput } from 'react-native-paper';
import useCustomCode from './Hooks/useCustomCode';
import useTextModifications from './Hooks/useTextModifications';
import {
  isChapterRefreshUrl,
  isPluginIssueReportUrl,
} from '../utils/sanitizeChapterText';
import { buildTtsQueueFromHtml } from '../utils/ttsQueue';
import { applyTextModifications } from '@utils/customCode';
import TtsSleepTimerDialog from './TtsSleepTimerDialog';

export type WebViewPostEvent = {
  type: string;
  data?: unknown;
  chapterId?: number;
  autoStartTTS?: boolean;
  index?: number;
  total?: number;
};

type WebViewReaderProps = {
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
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

/**
 * Last level seen, so a chapter can be rendered without the synchronous native
 * call the sync variant of this API performs. It is refreshed asynchronously
 * and pushed into the page, which also happens on every battery change event.
 */
let lastKnownBatteryLevel = 0;

const assetsUriPrefix = __DEV__
  ? 'http://localhost:8081/assets'
  : 'file:///android_asset';

const WebViewReader: React.FC<WebViewReaderProps> = ({
  onPress,
  onTouchStart,
  onSearchResult,
  searchTextRef,
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
    nextChapter,
    prevChapter,
    webViewRef,
    onUserInteraction,
    isTTSReadingRef,
    refetch,
  } = useChapterContext();
  const theme = useTheme();
  const initialReaderSettings = useMemo(
    () => ({
      ...initialChapterReaderSettings,
      ...getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS),
    }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentChapter.id],
  );

  const chapterGeneralSettings = useMemo(
    () => ({
      ...initialChapterGeneralSettings,
      ...getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS),
    }),
    // needed to preserve settings during chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentChapter.id],
  );

  const [batteryLevel] = useState(lastKnownBatteryLevel);
  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
  const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;
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

  useEffect(
    () => () => {
      mountedRef.current = false;
      cancelTtsTransition();
    },
    [cancelTtsTransition],
  );

  const [sleepTimerDialogVisible, setSleepTimerDialogVisible] = useState(false);

  const { customJS, customCSS } = useCustomCode(initialReaderSettings);

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

  /**
   * Serialising the whole chapter is expensive, so the document is built once
   * per chapter. Handing the WebView a different `source` also reloads the
   * page, so nothing that changes while a chapter is on screen may be part of
   * it – those updates go through `injectJavaScript` instead.
   */
  const source = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs
    const isNextChapterScreenVisible = nextChapterScreenVisible.current;
    return {
      baseUrl: !documentChapter.isDownloaded ? plugin?.site : undefined,
      headers: plugin?.imageRequestInit?.headers,
      method: plugin?.imageRequestInit?.method,
      body: plugin?.imageRequestInit?.body,
      html: `
        <!DOCTYPE html>
          <html dir="${readerDir}" class="${
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
                --theme-primary: ${theme.primary};
                --theme-onPrimary: ${theme.onPrimary};
                --theme-secondary: ${theme.secondary};
                --theme-tertiary: ${theme.tertiary};
                --theme-onTertiary: ${theme.onTertiary};
                --theme-onSecondary: ${theme.onSecondary};
                --theme-surface: ${theme.surface};
                --theme-surface-0-9: ${color(theme.surface)
                  .alpha(0.9)
                  .toString()};
                --theme-onSurface: ${theme.onSurface};
                --theme-surfaceVariant: ${theme.surfaceVariant};
                --theme-onSurfaceVariant: ${theme.onSurfaceVariant};
                --theme-outline: ${theme.outline};
                --theme-outlineVariant: ${theme.outlineVariant};
                --theme-rippleColor: ${theme.rippleColor};
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
              <link rel="stylesheet" href="${pluginCustomCSS}">
              <style id="ln-custom-css">${customCSS}</style>
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
              ">${documentChapter.name}</div>
              <div id="LNReader-chapter">
                ${processedHtml}
              </div>
              <div id="reader-ui"></div>
              </body>
              <script>
                var initialPageReaderConfig = ${JSON.stringify({
                  nextChapterScreenVisible: isNextChapterScreenVisible,
                })};


                var initialReaderConfig = ${JSON.stringify({
                  readerSettings: initialReaderSettings,
                  chapterGeneralSettings,
                  novel,
                  chapter: documentChapter,
                  batteryLevel,
                  autoSaveInterval: 2222,
                  DEBUG: __DEV__,
                  strings: {
                    finished:
                      getString('readerScreen.finished') +
                      ': ' +
                      documentChapter.name.trim(),
                    noNextChapter: getString('readerScreen.noNextChapter'),
                    loadingNextChapter: getString(
                      'readerScreen.loadingNextChapter',
                    ),
                    nextChapterLoadFailed: getString(
                      'readerScreen.nextChapterLoadFailed',
                    ),
                    retry: getString('common.retry'),
                    removeText: getString('common.remove'),
                    replaceText: getString('customCodeSettings.replace'),
                  },
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
              <script src="${pluginCustomJS}"></script>
              <script id="ln-custom-js">
              function fn(lnTarget = document.querySelector('#LNReader-chapter')){
                let html = lnTarget.innerHTML;
                ${customJS}
                lnTarget.innerHTML = html;
              }
              document.addEventListener('DOMContentLoaded', () => fn());
              </script>
          </html>
          `,
    };
  }, [
    batteryLevel,
    documentChapter,
    chapterGeneralSettings,
    processedHtml,
    customJS,
    customCSS,
    initialReaderSettings,
    novel,
    plugin,
    pluginCustomCSS,
    pluginCustomJS,
    readerDir,
    theme,
  ]);

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
        onShouldStartLoadWithRequest={({ url }) => {
          if (isPluginIssueReportUrl(url)) {
            void Linking.openURL(url);
            return false;
          }
          if (isChapterRefreshUrl(url)) {
            refetch();
            return false;
          }
          return true;
        }}
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(
            `if (window.reader && window.reader.batteryLevel) {
            window.reader.batteryLevel.val = ${lastKnownBatteryLevel};
          }`,
          );
          webViewRef.current?.injectJavaScript(
            adjacentChapterScriptRef.current,
          );
          webViewRef.current?.injectJavaScript(`
            window.tts?.setPlaybackState?.(${JSON.stringify(ttsState)});
            window.tts?.setSleepTimerState?.(${JSON.stringify(sleepTimer)});
            ${
              ttsProgress.total > 0
                ? `window.tts?.setActiveIndex?.(${ttsProgress.index});`
                : ''
            }
            true;
          `);

          const searchText = searchTextRef.current.trim();
          if (searchText) {
            webViewRef.current?.injectJavaScript(
              `window.readerSearch?.search(${JSON.stringify(
                searchText,
              )}); true;`,
            );
          }

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
        }}
        onMessage={(ev: { nativeEvent: { data: string } }) => {
          __DEV__ && onLogMessage(ev);
          const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);
          switch (event.type) {
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
