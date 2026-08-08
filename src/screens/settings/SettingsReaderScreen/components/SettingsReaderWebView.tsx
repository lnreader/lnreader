import { StatusBar, StyleSheet } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import WebView from 'react-native-webview';

import {
  useChapterGeneralSettings,
  useChapterReaderSettings,
  useTheme,
} from '@hooks/persisted';
import { getString } from '@i18n/translations';
import type { ChapterReaderSettings } from '@hooks/persisted/useSettings';

import color from 'color';
import { useBatteryLevel } from 'react-native-device-info';
import { useTtsSession } from '@screens/reader/hooks/useTtsSession';
import type { TtsSettings } from '@modules/nitro-tts';
import { dummyHTML } from '@screens/settings/SettingsCustomCodeScreen/Components/dummies';

type WebViewPostEvent = {
  type: string;
  data?: unknown;
  msg?: string;
};

type SettingsReaderWebViewProps = {
  customCSS?: string;
  customJS?: string;
};

const toNativeTtsSettings = (
  settings: ChapterReaderSettings['tts'],
): TtsSettings => ({
  engineName: settings?.engine?.name,
  voiceIdentifier: settings?.voice?.identifier,
  rate: settings?.rate ?? 1,
  pitch: settings?.pitch ?? 1,
});

const SettingsReaderWebView = ({
  customCSS,
  customJS,
}: SettingsReaderWebViewProps) => {
  const theme = useTheme();
  const webViewRef = useRef<WebView<object>>(null);

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
  const [hidden, setHidden] = useState(true);
  const batteryLevel = useBatteryLevel();
  const readerSettings = useChapterReaderSettings();
  const chapterGeneralSettings = useChapterGeneralSettings();
  const {
    command: runTtsCommand,
    loadAndPlay,
    progress: ttsProgress,
    seekTo: seekTts,
    state: ttsState,
    updateSettings: updateTtsSettings,
  } = useTtsSession();

  const assetsUriPrefix = useMemo(
    () => (__DEV__ ? 'http://localhost:8081/assets' : 'file:///android_asset'),
    [],
  );
  const webViewCSS = `
  <link rel="stylesheet" href="${assetsUriPrefix}/css/index.css">
    <style>
    :root {
      --StatusBar-currentHeight: ${StatusBar.currentHeight};
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
      --theme-surface-0-9: ${color(theme.surface).alpha(0.9).toString()};
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

    <style>${customCSS ?? readerSettings.customCSS}</style>
  `;

  const readerBackgroundColor = readerSettings.theme;

  useEffect(() => {
    updateTtsSettings(toNativeTtsSettings(readerSettings.tts));
  }, [readerSettings.tts, updateTtsSettings]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(`
      window.tts?.setPlaybackState?.(${JSON.stringify(ttsState)});
      true;
    `);
    if (ttsState === 'completed') {
      webViewRef.current?.injectJavaScript('window.tts?.complete?.(); true;');
    }
  }, [ttsState]);

  useEffect(() => {
    if (ttsProgress.total > 0) {
      webViewRef.current?.injectJavaScript(`
        window.tts?.setActiveIndex?.(${ttsProgress.index});
        true;
      `);
    }
  }, [ttsProgress]);

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      allowFileAccess={true}
      scalesPageToFit={true}
      showsVerticalScrollIndicator={false}
      javaScriptEnabled={true}
      style={[styles.webView, { backgroundColor: readerBackgroundColor }]}
      nestedScrollEnabled={true}
      onMessage={(ev: { nativeEvent: { data: string } }) => {
        const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);
        switch (event.type) {
          case 'hide':
            if (hidden) {
              webViewRef.current?.injectJavaScript('reader.hidden.val = true');
            } else {
              webViewRef.current?.injectJavaScript('reader.hidden.val = false');
            }
            setHidden(!hidden);
            break;
          case 'tts-queue': {
            const payload = event.data as
              | { queue?: unknown; startIndex?: unknown }
              | undefined;
            const queue = Array.isArray(payload?.queue)
              ? payload.queue.filter(
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
                novelName: novel.name,
                chapterName: chapter.name,
                coverUri: novel.cover,
              },
              toNativeTtsSettings(readerSettings.tts),
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
          case 'console':
            /* eslint-disable no-console */
            console.info(`[Console] ${JSON.stringify(event.msg, null, 2)}`);
        }
      }}
      source={{
        html: `
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                ${webViewCSS}
              </head>
              <body class="${
                chapterGeneralSettings.pageReader ? 'page-reader' : ''
              }">
                <div id="LNReader-chapter">
                ${dummyHTML}
                </div>
                <div id="reader-ui"></div>
              </body>
              <script>
                var initialReaderConfig = ${JSON.stringify({
                  readerSettings,
                  chapterGeneralSettings,
                  novel,
                  chapter,
                  nextChapter: chapter,
                  batteryLevel,
                  autoSaveInterval: 2222,
                  DEBUG: __DEV__,
                  strings: {
                    finished: `${getString(
                      'readerScreen.finished',
                    )}: ${chapter.name.trim()}`,
                    nextChapter: getString('readerScreen.nextChapter', {
                      name: chapter.name,
                    }),
                    noNextChapter: getString('readerScreen.noNextChapter'),
                  },
                })}
              </script>
              <script src="${assetsUriPrefix}/js/icons.js"></script>
              <script src="${assetsUriPrefix}/js/van.js"></script>
              <script src="${assetsUriPrefix}/js/text-vibe.js"></script>
              <script src="${assetsUriPrefix}/js/core.js"></script>
              <script src="${assetsUriPrefix}/js/index.js"></script>
              <script>
                ${customJS ?? readerSettings.customJS}
              </script>
            </html>
            `,
      }}
    />
  );
};

export default SettingsReaderWebView;

const styles = StyleSheet.create({
  webView: {
    flex: 1,
  },
});
