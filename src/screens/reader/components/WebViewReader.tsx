import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { NativeEventEmitter, NativeModules, StatusBar } from 'react-native';
import WebView from 'react-native-webview';
import color from 'color';

import { useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';

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
import * as Speech from 'expo-speech';
import { PLUGIN_STORAGE } from '@utils/Storages';
import { useChapterContext } from '../ChapterContext';
import {
  showTTSNotification,
  updateTTSNotification,
  dismissTTSNotification,
  getTTSAction,
  clearTTSAction,
} from '@utils/ttsNotification';

type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number };
  autoStartTTS?: boolean;
};

type WebViewReaderProps = {
  onPress(): void;
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

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

const assetsUriPrefix = __DEV__
  ? 'http://localhost:8081/assets'
  : 'file:///android_asset';

const WebViewReader: React.FC<WebViewReaderProps> = ({ onPress }) => {
  const {
    novel,
    chapter,
    chapterText: html,
    navigateChapter,
    saveProgress,
    nextChapter,
    prevChapter,
    webViewRef,
  } = useChapterContext();
  const theme = useTheme();
  // Use state for settings so they update when MMKV changes
  const [readerSettings, setReaderSettings] = useState<ChapterReaderSettings>(
    () =>
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
      initialChapterReaderSettings,
  );
  const chapterGeneralSettings = useMemo(
    () =>
      getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) ||
      initialChapterGeneralSettings,
    // needed to preserve settings during chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );
  
  // Update readerSettings when chapter changes
  useEffect(() => {
    setReaderSettings(
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
        initialChapterReaderSettings,
    );
  }, [chapter.id]);
  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);
  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
  const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;
  const nextChapterScreenVisible = useRef<boolean>(false);
  const autoStartTTSRef = useRef<boolean>(false);
  const isTTSReadingRef = useRef<boolean>(false);

  useEffect(() => {
    const checkNotificationActions = setInterval(() => {
      const action = getTTSAction();
      if (action) {
        clearTTSAction();
        switch (action) {
          case 'TTS_PLAY_PAUSE':
            webViewRef.current?.injectJavaScript(`
              if (window.tts) {
                if (tts.reading) {
                  tts.pause();
                } else {
                  tts.resume();
                }
              }
            `);
            break;
          case 'TTS_STOP':
            webViewRef.current?.injectJavaScript(`
              if (window.tts) {
                tts.stop();
              }
            `);
            break;
          case 'TTS_NEXT':
            webViewRef.current?.injectJavaScript(`
              if (window.tts && window.reader && window.reader.nextChapter) {
                window.reader.post({ type: 'next', autoStartTTS: true });
              }
            `);
            break;
        }
      }
    }, 500);

    return () => {
      clearInterval(checkNotificationActions);
    };
  }, [webViewRef]);

  useEffect(() => {
    if (isTTSReadingRef.current) {
      updateTTSNotification({
        novelName: novel?.name || 'Unknown',
        chapterName: chapter.name,
        isPlaying: isTTSReadingRef.current,
      });
    }
  }, [novel?.name, chapter.name]);

  useEffect(() => {
    return () => {
      dismissTTSNotification();
    };
  }, []);

  useEffect(() => {
    const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
      switch (key) {
        case CHAPTER_READER_SETTINGS:
          // Update local state with new settings
          const newSettings =
            getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
            initialChapterReaderSettings;
          setReaderSettings(newSettings);
          
          // Stop any currently playing speech
          Speech.stop();
          
          // Update WebView settings
          webViewRef.current?.injectJavaScript(
            `
            reader.readerSettings.val = ${MMKVStorage.getString(
              CHAPTER_READER_SETTINGS,
            )};
            // Auto-restart TTS if currently reading
            if (window.tts && tts.reading) {
              const currentElement = tts.currentElement;
              const wasReading = tts.reading;
              tts.stop();
              if (wasReading) {
                setTimeout(() => {
                  tts.start(currentElement);
                }, 100);
              }
            }
            `,
          );
          break;
        case CHAPTER_GENERAL_SETTINGS:
          webViewRef.current?.injectJavaScript(
            `reader.generalSettings.val = ${MMKVStorage.getString(
              CHAPTER_GENERAL_SETTINGS,
            )}`,
          );
          break;
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
  }, [webViewRef]);
  return (
    <WebView
      ref={webViewRef}
      style={{ backgroundColor: readerSettings.theme }}
      allowFileAccess={true}
      originWhitelist={['*']}
      scalesPageToFit={true}
      showsVerticalScrollIndicator={false}
      javaScriptEnabled={true}
      webviewDebuggingEnabled={__DEV__}
      onLoadEnd={() => {
        if (autoStartTTSRef.current) {
          autoStartTTSRef.current = false;
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(`
              (function() {
                if (window.tts && reader.generalSettings.val.TTSEnable) {
                  setTimeout(() => {
                    tts.start();
                    const controller = document.getElementById('TTS-Controller');
                    if (controller && controller.firstElementChild) {
                      controller.firstElementChild.innerHTML = pauseIcon;
                    }
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
            navigateChapter('PREV');
            break;
          case 'save':
            if (event.data && typeof event.data === 'number') {
              saveProgress(event.data);
            }
            break;
          case 'speak':
            if (event.data && typeof event.data === 'string') {
              if (!isTTSReadingRef.current) {
                isTTSReadingRef.current = true;
                showTTSNotification({
                  novelName: novel?.name || 'Unknown',
                  chapterName: chapter.name,
                  isPlaying: true,
                });
              } else {
                updateTTSNotification({
                  novelName: novel?.name || 'Unknown',
                  chapterName: chapter.name,
                  isPlaying: true,
                });
              }
              Speech.speak(event.data, {
                onDone() {
                  webViewRef.current?.injectJavaScript('tts.next?.()');
                },
                voice: readerSettings.tts?.voice?.identifier,
                pitch: readerSettings.tts?.pitch || 1,
                rate: readerSettings.tts?.rate || 1,
              });
            } else {
              webViewRef.current?.injectJavaScript('tts.next?.()');
            }
            break;
          case 'stop-speak':
            Speech.stop();
            isTTSReadingRef.current = false;
            dismissTTSNotification();
            break;
          case 'tts-state':
            if (event.data && typeof event.data === 'object') {
              const data = event.data as { isReading?: boolean };
              const isReading = data.isReading === true;
              isTTSReadingRef.current = isReading;
              updateTTSNotification({
                novelName: novel?.name || 'Unknown',
                chapterName: chapter.name,
                isPlaying: isReading,
              });
            }
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
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
              <link rel="stylesheet" href="${assetsUriPrefix}/css/index.css">
              <link rel="stylesheet" href="${assetsUriPrefix}/css/pageReader.css">
              <link rel="stylesheet" href="${assetsUriPrefix}/css/toolWrapper.css">
              <link rel="stylesheet" href="${assetsUriPrefix}/css/tts.css">
              <style>
              :root {
                --StatusBar-currentHeight: ${StatusBar.currentHeight}px;
                --readerSettings-theme: ${readerSettings.theme};
                --readerSettings-padding: ${readerSettings.padding}px;
                --readerSettings-textSize: ${readerSettings.textSize}px;
                --readerSettings-textColor: ${readerSettings.textColor};
                --readerSettings-textAlign: ${readerSettings.textAlign};
                --readerSettings-lineHeight: ${readerSettings.lineHeight};
                --readerSettings-fontFamily: ${readerSettings.fontFamily};
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
                
                @font-face {
                  font-family: ${readerSettings.fontFamily};
                  src: url("file:///android_asset/fonts/${
                    readerSettings.fontFamily
                  }.ttf");
                }
                </style>

              <link rel="stylesheet" href="${pluginCustomCSS}">
              <style>${readerSettings.customCSS}</style>
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
                  readerSettings,
                  chapterGeneralSettings,
                  novel,
                  chapter,
                  nextChapter,
                  prevChapter,
                  batteryLevel,
                  autoSaveInterval: 2222,
                  DEBUG: __DEV__,
                  strings: {
                    finished: `${getString(
                      'readerScreen.finished',
                    )}: ${chapter.name.trim()}`,
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
              <script src="${assetsUriPrefix}/js/index.js"></script>
              <script src="${pluginCustomJS}"></script>
              <script>
                ${readerSettings.customJS}
              </script>
          </html>
          `,
      }}
    />
  );
};

export default memo(WebViewReader);
