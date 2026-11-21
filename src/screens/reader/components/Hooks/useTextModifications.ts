import { useChapterReaderSettings } from '@hooks/persisted/useSettings';
import { applyTextModifications } from '@utils/customCode';
import { useMemo, useState, type RefObject } from 'react';
import type WebView from 'react-native-webview';
import type { WebViewPostEvent } from '../WebViewReader';

type TextAction = { type: 'remove' | 'replace'; text: string };

export default function useTextModifications(
  chapterText: string,
  webViewRef: RefObject<WebView<object> | null>,
) {
  const [pendingTextAction, setPendingTextAction] = useState<TextAction | null>(
    null,
  );
  const [replacementText, setReplacementText] = useState('');

  const { setChapterReaderSettings, ...readerSettings } =
    useChapterReaderSettings();

  // html is computed once per chapter at load time, using the current saved
  // settings. Subsequent dynamic remove/replace actions inject JS directly
  // into the WebView DOM instead of rebuilding the HTML source (which would
  // reload the WebView and lose the reading position).
  const html = useMemo(
    () =>
      applyTextModifications(
        chapterText,
        readerSettings.removeText,
        readerSettings.replaceText,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapterText],
  );

  function dismissTextAction() {
    setPendingTextAction(null);
    setReplacementText('');
  }

  function confirmTextAction() {
    if (!pendingTextAction) return;

    const { type, text } = pendingTextAction;
    if (type === 'remove') {
      if (!readerSettings.removeText.includes(text)) {
        setChapterReaderSettings({
          removeText: [...readerSettings.removeText, text],
        });
      }
      webViewRef.current?.injectJavaScript(
        `window.textRemover?.performRemove?.(${JSON.stringify(text)}); true;`,
      );
    } else {
      if (!(text in readerSettings.replaceText)) {
        setChapterReaderSettings({
          replaceText: {
            ...readerSettings.replaceText,
            [text]: replacementText,
          },
        });
      }
      webViewRef.current?.injectJavaScript(
        `window.textRemover?.performReplace?.(${JSON.stringify(
          text,
        )}, ${JSON.stringify(replacementText)}); true;`,
      );
    }
    dismissTextAction();
  }

  function eventTextAction(event: WebViewPostEvent) {
    if (!event.data || typeof event.data !== 'object') return;

    const [type, text] = Object.entries(event.data)[0] ?? [];
    if (type !== 'remove' && type !== 'replace') return;
    if (typeof text !== 'string' || !text.trim()) return;

    setPendingTextAction(current => current ?? { type, text });
  }

  return {
    html,
    pendingTextAction,
    replacementText,
    setReplacementText,
    confirmTextAction,
    dismissTextAction,
    eventTextAction,
  };
}
