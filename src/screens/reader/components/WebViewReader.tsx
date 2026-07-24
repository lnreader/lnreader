import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  NativeEventEmitter,
  NativeModules,
  StatusBar,
} from 'react-native';
import WebView from 'react-native-webview';
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
import { getBatteryLevelSync } from 'react-native-device-info';
import { PLUGIN_STORAGE } from '@utils/Storages';
import { useChapterContext } from '../ChapterContext';
import { ReaderSearchResult } from '../types';
import { useTtsSession } from '../hooks/useTtsSession';
import type { TtsSettings } from '@modules/nitro-tts';

type WebViewPostEvent = {
  type: string;
  data?: unknown;
  autoStartTTS?: boolean;
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
    a.voice?.identifier === b.voice?.identifier
  );
};

const toNativeTtsSettings = (
  settings: ChapterReaderSettings['tts'],
): TtsSettings => ({
  voiceIdentifier: settings?.voice?.identifier,
  rate: settings?.rate ?? 1,
  pitch: settings?.pitch ?? 1,
});

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

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
    chapterText: html,
    navigateChapter,
    saveProgress,
    nextChapter,
    prevChapter,
    webViewRef,
    onUserInteraction,
    isTTSReadingRef,
  } = useChapterContext();
  const theme = useTheme();
  const initialReaderSettings = useMemo(
    () =>
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
      initialChapterReaderSettings,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  const chapterGeneralSettings = useMemo(
    () =>
      getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) ||
      initialChapterGeneralSettings,
    // needed to preserve settings during chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  // Update battery level when chapter changes to ensure fresh value on navigation
  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);
  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
  const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;
  const nextChapterScreenVisible = useRef<boolean>(false);
  const autoStartTTSRef = useRef<boolean>(false);
  const activeChapterIdRef = useRef(chapter.id);
  const {
    command: runTtsCommand,
    error: ttsError,
    loadAndPlay,
    progress: ttsProgress,
    seekTo: seekTts,
    state: ttsState,
    updateSettings: updateTtsSettings,
  } = useTtsSession();

  const [readerSettings, setReaderSettings] = useState(
    () =>
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
      initialChapterReaderSettings,
  );
  // Update readerSettings when chapter changes
  useEffect(() => {
    setReaderSettings(
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
        initialChapterReaderSettings,
    );
  }, [chapter.id]);

  const readerSettingsRef = useRef<ChapterReaderSettings>(readerSettings);

  useEffect(() => {
    readerSettingsRef.current = readerSettings;
  }, [readerSettings]);

  useEffect(() => {
    isTTSReadingRef.current = ttsState === 'playing';
    webViewRef.current?.injectJavaScript(`
      window.tts?.setPlaybackState?.(${JSON.stringify(ttsState)});
      true;
    `);
    if (ttsState === 'completed') {
      webViewRef.current?.injectJavaScript('window.tts?.complete?.(); true;');
    }
  }, [isTTSReadingRef, ttsState, webViewRef]);

  useEffect(() => {
    if (ttsProgress.total > 0) {
      webViewRef.current?.injectJavaScript(`
        window.tts?.setActiveIndex?.(${ttsProgress.index});
        true;
      `);
    }
  }, [ttsProgress, webViewRef]);

  useEffect(() => {
    if (ttsError) {
      console.warn(`[TTS] ${ttsError}`);
      Alert.alert('Text to speech', ttsError);
    }
  }, [ttsError]);

  useEffect(() => {
    if (activeChapterIdRef.current !== chapter.id) {
      activeChapterIdRef.current = chapter.id;
      runTtsCommand('stop');
    }
  }, [chapter.id, runTtsCommand]);

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
        webViewRef.current?.injectJavaScript(
          `reader.batteryLevel.val = ${level}`,
        );
      },
    );
    return () => {
      subscription.remove();
      mmkvListener.remove();
    };
  }, [updateTtsSettings, webViewRef]);
  const isRTL = plugin?.lang === 'Arabic' || plugin?.lang === 'Hebrew';
  const readerDir = isRTL ? 'rtl' : 'ltr';

  return (
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
      onLoadEnd={() => {
        // Update battery level when WebView finishes loading
        const currentBatteryLevel = getBatteryLevelSync();
        webViewRef.current?.injectJavaScript(
          `if (window.reader && window.reader.batteryLevel) {
            window.reader.batteryLevel.val = ${currentBatteryLevel};
          }`,
        );

        const searchText = searchTextRef.current.trim();
        if (searchText) {
          webViewRef.current?.injectJavaScript(
            `window.readerSearch?.search(${JSON.stringify(searchText)}); true;`,
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
              typeof payload?.startIndex === 'number' ? payload.startIndex : 0;
            void loadAndPlay(
              queue,
              startIndex,
              {
                novelName: novel?.name || 'Unknown',
                chapterName: chapter.name,
                coverUri: novel?.cover || undefined,
              },
              toNativeTtsSettings(readerSettingsRef.current.tts),
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
              case 'stop':
                runTtsCommand(data.command);
                break;
              case 'seekTo':
                if (typeof data.index === 'number') {
                  seekTts(data.index);
                }
                break;
            }
            break;
          }
          case 'tts-error':
            if (typeof event.data === 'string') {
              Alert.alert('Text to speech', event.data);
            }
            break;
          case 'hide':
            onPress();
            break;
          case 'next':
            nextChapterScreenVisible.current = true;
            if (event.autoStartTTS) {
              autoStartTTSRef.current = true;
            }
            navigateChapter('NEXT');
            break;
          case 'prev':
            if (event.autoStartTTS) {
              autoStartTTSRef.current = true;
            }
            navigateChapter('PREV');
            break;
          case 'save':
            if (event.data && typeof event.data === 'number') {
              saveProgress(event.data);
            }
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
      source={{
        baseUrl: !chapter.isDownloaded ? plugin?.site : undefined,
        headers: plugin?.imageRequestInit?.headers,
        method: plugin?.imageRequestInit?.method,
        body: plugin?.imageRequestInit?.body,
        html: `
        <!DOCTYPE html>
          <html dir="${readerDir}">
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
              <style id="ln-custom-css">${
                initialReaderSettings.customCSS
              }</style>
            </head>
            <body class="${
              chapterGeneralSettings.pageReader ? 'page-reader' : ''
            }">
              <div class="transition-chapter" style="transform: ${
                nextChapterScreenVisible.current
                  ? 'translateX(-100%)'
                  : 'translateX(0%)'
              };
              ${chapterGeneralSettings.pageReader ? '' : 'display: none'}"
              ">${chapter.name}</div>
              <div id="LNReader-chapter">
                ${html}  
              </div>
              <div id="reader-ui"></div>
              </body>
              <script>
                var initialPageReaderConfig = ${JSON.stringify({
                  nextChapterScreenVisible: nextChapterScreenVisible.current,
                })};
 
 
                var initialReaderConfig = ${JSON.stringify({
                  readerSettings: initialReaderSettings,
                  chapterGeneralSettings,
                  novel,
                  chapter,
                  nextChapter,
                  prevChapter,
                  batteryLevel,
                  autoSaveInterval: 2222,
                  DEBUG: __DEV__,
                  strings: {
                    finished:
                      getString('readerScreen.finished') +
                      ': ' +
                      chapter.name.trim(),
                    nextChapter: getString('readerScreen.nextChapter', {
                      name: nextChapter?.name,
                    }),
                    noNextChapter: getString('readerScreen.noNextChapter'),
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
              <script src="${pluginCustomJS}"></script>
              <script id="ln-custom-js">
                ${initialReaderSettings.customJS}
              </script>
          </html>
          `,
      }}
    />
  );
};

export default memo(WebViewReader);
