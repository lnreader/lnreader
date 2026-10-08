import { memo } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';

import { useChapterReaderSettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { useReaderWebView } from '../ChapterContext';

export type ReaderTextAction = 'copy' | 'search' | 'remove' | 'replace';

const TEXT_ACTIONS: { key: ReaderTextAction; label: () => string }[] = [
  { key: 'copy', label: () => getString('common.copy') },
  { key: 'search', label: () => getString('common.search') },
  { key: 'remove', label: () => getString('common.remove') },
  { key: 'replace', label: () => getString('common.replaceText') },
];

const isTextAction = (key: string): key is ReaderTextAction =>
  TEXT_ACTIONS.some(action => action.key === key);

// The page's markup never changes (everything goes through the bridge), so
// the reading position survives re-renders. The WebView reads the selection
// from the top page, not the chapter frames, so `onTextAction` gets an empty
// text for the caller to fill from the reader's selection.
const WebViewReader = ({
  onTextAction,
}: {
  onTextAction: (action: ReaderTextAction, selectedText: string) => void;
}) => {
  const { ref, source, onMessage } = useReaderWebView();
  const { theme: background } = useChapterReaderSettings();
  return (
    <WebView<object>
      ref={ref}
      source={source}
      onMessage={onMessage}
      style={[styles.webView, { backgroundColor: background }]}
      originWhitelist={['*']}
      javaScriptEnabled
      allowFileAccess
      // Chapter images of downloaded chapters are local files.
      allowFileAccessFromFileURLs
      // Development assets come over plain http from the dev server.
      mixedContentMode={__DEV__ ? 'always' : 'never'}
      setSupportMultipleWindows={false}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      textZoom={100}
      menuItems={TEXT_ACTIONS.map(action => ({
        key: action.key,
        label: action.label(),
      }))}
      onCustomMenuSelection={({ nativeEvent }) => {
        if (isTextAction(nativeEvent.key)) {
          onTextAction(nativeEvent.key, nativeEvent.selectedText ?? '');
        }
      }}
      webviewDebuggingEnabled={__DEV__}
      // Links are handed to the app by the page; nothing navigates it away.
      onShouldStartLoadWithRequest={({ url }) =>
        url.startsWith('about:') || url.startsWith('data:')
      }
    />
  );
};

const styles = StyleSheet.create({
  webView: { flex: 1 },
});

export default memo(WebViewReader);
