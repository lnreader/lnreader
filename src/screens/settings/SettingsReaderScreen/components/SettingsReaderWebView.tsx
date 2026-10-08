import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import {
  useChapterGeneralSettings,
  useChapterReaderSettings,
  useTheme,
} from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { dummyHTML } from '@screens/settings/SettingsCustomCodeScreen/Components/dummies';
import { composeCSS, composeJS } from '@utils/customCode';
import { getReaderAssetsUri, READER_FONTS_URI } from '@utils/readerAssets';
import { toReaderPreferences } from '../../../reader/engine/preferences';
import {
  type NativeToWebMessage,
  parseWebMessage,
  toInjectedScript,
} from '../../../reader/engine/protocol';
import { buildShellHtml } from '../../../reader/engine/shell';
import { readerCssVariables } from '../../../reader/utils/cssVariables';

const PREVIEW_CHAPTER = { id: 1, name: 'Chapter 1: The Preview' };

/** Pass `customCSS` or `customJS` to preview unsaved code. */
const SettingsReaderWebView = ({
  customCSS,
  customJS,
}: {
  customCSS?: string;
  customJS?: string;
}) => {
  const readerSettings = useChapterReaderSettings();
  const generalSettings = useChapterGeneralSettings();
  const ref = useRef<WebView<object>>(null);
  const openedRef = useRef(false);
  const assetsUri = getReaderAssetsUri();
  const [html] = useState(() =>
    buildShellHtml(assetsUri, readerSettings.theme),
  );
  const css = customCSS ?? composeCSS(readerSettings.codeSnippetsCSS);
  const js = customJS ?? composeJS(readerSettings.codeSnippetsJS);
  const theme = useTheme();
  const preferences = useMemo(
    () =>
      toReaderPreferences(
        readerSettings,
        generalSettings,
        css,
        readerCssVariables(readerSettings, theme),
      ),
    [css, generalSettings, readerSettings, theme],
  );

  const send = useCallback((message: NativeToWebMessage) => {
    ref.current?.injectJavaScript(toInjectedScript(message));
  }, []);

  const open = useCallback(() => {
    openedRef.current = true;
    send({
      type: 'open',
      novelName: 'LNReader',
      novelId: 0,
      pluginId: 'preview',
      sections: [PREVIEW_CHAPTER],
      start: { chapterId: PREVIEW_CHAPTER.id, fraction: 0 },
      preferences,
      assetsUri: READER_FONTS_URI,
      dir: 'ltr',
      customJs: js,
      pluginJs: '',
      battery: -1,
      strings: {
        retry: getString('common.retry'),
        finished: getString('readerScreen.finished'),
        nextChapter: getString('readerScreen.nextChapter', {
          name: '%{name}',
        }),
        noNextChapter: getString('readerScreen.noNextChapter'),
      },
    });
  }, [js, preferences, send]);

  useEffect(() => {
    if (openedRef.current) {
      send({ type: 'preferences', preferences });
    }
  }, [preferences, send]);

  // Scripts are compiled when the book opens.
  useEffect(() => {
    if (openedRef.current) {
      open();
    }
    // Only a script change reopens the sample.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [js]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseWebMessage(event.nativeEvent.data);
    if (message?.type === 'ready') {
      open();
    } else if (message?.type === 'request-section') {
      send({
        type: 'section-content',
        requestId: message.requestId,
        html: dummyHTML,
      });
    }
  };

  return (
    <WebView<object>
      ref={ref}
      source={{ html }}
      onMessage={onMessage}
      style={[styles.webView, { backgroundColor: readerSettings.theme }]}
      originWhitelist={['*']}
      javaScriptEnabled
      allowFileAccess
      mixedContentMode={__DEV__ ? 'always' : 'never'}
      textZoom={100}
      showsVerticalScrollIndicator={false}
      onShouldStartLoadWithRequest={({ url }) =>
        url.startsWith('about:') || url.startsWith('data:')
      }
    />
  );
};

const styles = StyleSheet.create({
  webView: { flex: 1 },
});

export default SettingsReaderWebView;
