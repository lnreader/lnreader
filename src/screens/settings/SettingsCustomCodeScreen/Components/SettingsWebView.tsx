import React, { memo, useEffect, useMemo, useRef } from 'react';
import { NativeEventEmitter, NativeModules, StatusBar } from 'react-native';
import WebView from 'react-native-webview';
import color from 'color';
import { getString } from '@strings/translations';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  CHAPTER_READER_SETTINGS,
  useChapterGeneralSettings,
  useChapterReaderSettings,
} from '@hooks/persisted/useSettings';

import { getBatteryLevelSync } from 'react-native-device-info';
import * as Speech from 'expo-speech';
import { dummyHTML } from './dummies';
import { useTheme } from '@hooks/persisted';

type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number };
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

const novel = {
  'artist': null,
  'author': 'LNReader-kun',
  'cover':
    'file:///storage/emulated/0/Android/data/com.rajarsheechatterjee.LNReader/files/Novels/lightnovelcave/16/cover.png?1717862123181',
  'genres': 'Action,Hero',
  'id': 16,
  'inLibrary': 1,
  'isLocal': 0,
  'name': 'Preview Man (LN)',
  'path': 'novel/preview-man-16091321',
  'pluginId': 'lightnovelcave',
  'status': 'Ongoing',
  'summary':
    'To preview or not preview. A question that bothered humanity for a long time, until one day… Preview Man appeared.Show More',
  'totalPages': 8,
};
const chapter = {
  'bookmark': 0,
  'chapterNumber': 1,
  'id': 3722,
  'isDownloaded': 1,
  'name': 'Chapter 1 - The rise of Preview Man',
  'novelId': 16,
  'page': '2',
  'path': 'novel/preview-man/chapter-1',
  'position': 0,
  'progress': 3,
  'readTime': '2100-01-01 00:00:00',
  'releaseTime': 'January 1, 2100',
  'unread': 1,
  'updatedTime': null,
};

const SettingsWebView = () => {
  const webViewRef = useRef<WebView>(null);
  const theme = useTheme();
  const settings = useChapterReaderSettings();
  const generalSettings = useChapterGeneralSettings();
  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);

  useEffect(() => {
    const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
      switch (key) {
        case CHAPTER_READER_SETTINGS:
          webViewRef.current?.injectJavaScript(
            `reader.settings.val = ${MMKVStorage.getString(
              CHAPTER_READER_SETTINGS,
            )}`,
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

  const customJS = useMemo(() => {
    return settings.codeSnippetsJS
      .map(snippet => {
        if (!snippet.active) return null;
        return `
      try {
        ${snippet.code}
      } catch (error) {
        alert('Error loading executing ${snippet.name}:\n' + error);
      }
      `;
      })
      .filter(Boolean)
      .join('\n');
  }, [settings.codeSnippetsJS]);

  const customCSS = useMemo(() => {
    return settings.codeSnippetsCSS
      .map(snippet => {
        if (!snippet.active) return null;
        return snippet.code;
      })
      .filter(Boolean)
      .join('\n');
  }, [settings.codeSnippetsCSS]);

  const preparedDummyHTML = useMemo(() => {
    let resultHtml = dummyHTML;
    settings.removeText.forEach(text => {
      resultHtml = resultHtml.replace(text, '');
    });
    Object.entries(settings.replaceText).forEach(([text, replacement]) => {
      resultHtml = resultHtml.replace(text, replacement);
    });
    return resultHtml;
  }, [settings.removeText, settings.replaceText]);

  const webViewCSS = useMemo(
    () => `
  <style>
    :root {
      --StatusBar-currentHeight: ${StatusBar.currentHeight};
      --readerSettings-theme: ${settings.theme};
      --readerSettings-padding: ${settings.padding}px;
      --readerSettings-textSize: ${settings.textSize}px;
      --readerSettings-textColor: ${settings.textColor};
      --readerSettings-textAlign: ${settings.textAlign};
      --readerSettings-lineHeight: ${settings.lineHeight};
      --readerSettings-fontFamily: ${settings.fontFamily};
      --theme-primary: ${theme.primary};
      --theme-onPrimary: ${theme.onPrimary};
      --theme-secondary: ${theme.secondary};
      --theme-tertiary: ${theme.tertiary};
      --theme-onTertiary: ${theme.onTertiary};
      --theme-onSecondary: ${theme.onSecondary};
      --theme-surface: ${theme.surface};
      --theme-surface-0-9: ${color(theme.surface).alpha(0.9).toString()};
      --theme-onSurface: ${theme.onSurface};
      --theme-surfaceVariant: ${theme.surfaceVariant};
      --theme-onSurfaceVariant: ${theme.onSurfaceVariant};
      --theme-outline: ${theme.outline};
      --theme-rippleColor: ${theme.rippleColor};
    }
    @font-face {
      font-family: ${settings.fontFamily};
      src: url("file:///android_asset/fonts/${settings.fontFamily}.ttf");
    }
    </style>
    <link rel="stylesheet" href="${assetsUriPrefix}/css/index.css">
    <link rel="stylesheet" href="${assetsUriPrefix}/css/pageReader.css">
    <link rel="stylesheet" href="${assetsUriPrefix}/css/toolWrapper.css">
    <link rel="stylesheet" href="${assetsUriPrefix}/css/tts.css">
    <style>
    ${customCSS}
  </style>
  `,
    [
      settings.theme,
      customCSS,
      settings.fontFamily,
      settings.lineHeight,
      settings.padding,
      settings.textAlign,
      settings.textColor,
      settings.textSize,
      theme.onPrimary,
      theme.onSecondary,
      theme.onSurface,
      theme.onSurfaceVariant,
      theme.onTertiary,
      theme.outline,
      theme.primary,
      theme.rippleColor,
      theme.secondary,
      theme.surface,
      theme.surfaceVariant,
      theme.tertiary,
    ],
  );

  const webViewSource = useMemo(
    () => ({
      html: `
            <html >
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                ${webViewCSS}
                <script async>
                  var initSettings = {
                    showScrollPercentage: ${
                      generalSettings.showScrollPercentage
                    },
                    swipeGestures: false,
                    showBatteryAndTime: ${generalSettings.showBatteryAndTime},
                    verticalSeekbar: ${generalSettings.verticalSeekbar},
                    bionicReading: ${generalSettings.bionicReading},
                  }
                  var batteryLevel = ${batteryLevel};
                  var autoSaveInterval = 2222;
                  var { NOVEL, CHAPTER } = ${JSON.stringify({
                    NOVEL: novel,
                    CHAPTER: chapter,
                  })}
                </script>
              </head>
              <body class="${generalSettings.pageReader ? 'page-reader' : ''}">
                            <div class="transition-chapter" style="transform: translateX(0%);
                            ${
                              generalSettings.pageReader ? '' : 'display: none'
                            }"
                            >${chapter.name}</div>
                            <div id="LNReader-chapter">
                              ${preparedDummyHTML}
                            </div>
                            <div id="reader-ui"></div>
                            </body>
                            <script>
                              var initialPageReaderConfig = ${JSON.stringify({
                                nextChapterScreenVisible: false,
                              })};


                              var initialReaderConfig = ${JSON.stringify({
                                readerSettings: settings,
                                chapterGeneralSettings: settings,
                                novel,
                                chapter,
                                nextChapter: undefined,
                                prevChapter: undefined,
                                batteryLevel,
                                autoSaveInterval: 2222,
                                DEBUG: __DEV__,
                                strings: {
                                  finished: `${getString(
                                    'readerScreen.finished',
                                  )}: ${chapter.name.trim()}`,
                                  nextChapter: getString(
                                    'readerScreen.nextChapter',
                                    {
                                      name: undefined,
                                    },
                                  ),
                                  noNextChapter: getString(
                                    'readerScreen.noNextChapter',
                                  ),
                                },
                              })}
                            </script>
                            <script src="${assetsUriPrefix}/js/icons.js"></script>
                            <script src="${assetsUriPrefix}/js/van.js"></script>
                            <script src="${assetsUriPrefix}/js/text-vibe.js"></script>
                            <script src="${assetsUriPrefix}/js/core.js"></script>
                            <script src="${assetsUriPrefix}/js/index.js"></script>
                            <script>
                            ${customJS}
                              async function fn(){
                                  let novelName = "${novel.name}";
                                  let chapterName = "${chapter.name}";
                                  let sourceId = "${novel.pluginId}";
                                  let chapterId =${chapter.id};
                                  let novelId =${chapter.novelId};
                                  let html = document.getElementById("LNReader-chapter").innerHTML;
                                }
                                document.addEventListener("DOMContentLoaded", fn);
                            </script>
            </html>
            `,
    }),
    [
      webViewCSS,
      generalSettings.showScrollPercentage,
      generalSettings.showBatteryAndTime,
      generalSettings.verticalSeekbar,
      generalSettings.bionicReading,
      generalSettings.pageReader,
      batteryLevel,
      preparedDummyHTML,
      settings,
      customJS,
    ],
  );

  return (
    <WebView
      ref={webViewRef}
      style={{ backgroundColor: settings.theme }}
      allowFileAccess={true}
      originWhitelist={['*']}
      scalesPageToFit={true}
      showsVerticalScrollIndicator={false}
      javaScriptEnabled={true}
      onMessage={(ev: { nativeEvent: { data: string } }) => {
        __DEV__ && onLogMessage(ev);
        const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);
        switch (event.type) {
          case 'hide':
            break;
          case 'next':
            break;
          case 'prev':
            break;
          case 'save':
            break;
          case 'speak':
            if (event.data && typeof event.data === 'string') {
              Speech.speak(event.data, {
                onDone() {
                  webViewRef.current?.injectJavaScript('tts.next?.()');
                },
                voice: settings.tts?.voice?.identifier,
                pitch: settings.tts?.pitch || 1,
                rate: settings.tts?.rate || 1,
              });
            } else {
              webViewRef.current?.injectJavaScript('tts.next?.()');
            }
            break;
          case 'stop-speak':
            Speech.stop();
            break;
        }
      }}
      source={webViewSource}
    />
  );
};

export default memo(SettingsWebView);
