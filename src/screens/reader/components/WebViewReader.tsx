import React, { memo, useMemo, useRef } from 'react';
import { StatusBar } from 'react-native';
import WebView from 'react-native-webview';
import color from 'color';

import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

import { getPlugin } from '@plugins/pluginManager';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  ChapterGeneralSettings,
  ChapterReaderSettings,
  initialChapterGeneralSettings,
  useChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import { getBatteryLevelSync } from 'react-native-device-info';
import { PLUGIN_STORAGE } from '@utils/Storages';
import { useChapterContext } from '../ChapterContext';
import { useTTS, WebViewPostEvent } from './hooks/useTTS';
import { useUpdateWebview } from './hooks/useUpdateWebview';
import { ReaderSearchResult } from '../types';
import { useBoolean } from '@hooks/index';

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

const assetsUriPrefix = __DEV__
  ? 'http://localhost:8081/assets'
  : 'file:///android_asset';

const handleSaveMessage = (
  event: WebViewPostEvent,
  saveProgress: (percentage: number) => void,
) => {
  if (event.data && typeof event.data === 'number') {
    saveProgress(event.data);
  }
};

const handleSearchResultMessage = (
  event: WebViewPostEvent,
  searchTextRef: React.MutableRefObject<string>,
  onSearchResult: (result: ReaderSearchResult) => void,
) => {
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
      return;
    }
    const total = typeof data.total === 'number' ? data.total : 0;
    onSearchResult({
      query,
      current: typeof data.current === 'number' ? data.current : 0,
      total,
      renderedTotal:
        typeof data.renderedTotal === 'number' ? data.renderedTotal : total,
      isTruncated: data.isTruncated === true,
    });
  }
};

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
  const readerSettings = useChapterReaderSettings();
  const initialReaderSettings = useMemo(
    () => readerSettings,
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
  const nextChapterScreenVisible = useBoolean(false);

  const readerSettingsRef = useRef<ChapterReaderSettings>(
    initialReaderSettings,
  );

  const { handleTTSEvent, onTTSSettingsChanged, autoStartTTSRef } = useTTS({
    webViewRef,
    isTTSReadingRef,
    novel,
    chapter,
    readerSettingsRef,
    onUserInteraction,
  });

  const { handleLoadEnd } = useUpdateWebview({
    webViewRef,
    readerSettingsRef,
    searchTextRef,
    autoStartTTSRef,
    onTTSSettingsChanged,
  });

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
      onLoadEnd={handleLoadEnd}
      onMessage={(ev: { nativeEvent: { data: string } }) => {
        __DEV__ && onLogMessage(ev);
        const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);
        if (handleTTSEvent(event)) return;
        switch (event.type) {
          case 'hide':
            onPress();
            break;
          case 'next':
            nextChapterScreenVisible.setTrue();
            navigateChapter('NEXT');
            break;
          case 'prev':
            navigateChapter('PREV');
            break;
          case 'save':
            handleSaveMessage(event, saveProgress);
            break;
          case 'search-result':
            handleSearchResultMessage(event, searchTextRef, onSearchResult);
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
                nextChapterScreenVisible.value
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
                  nextChapterScreenVisible: nextChapterScreenVisible.value,
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
