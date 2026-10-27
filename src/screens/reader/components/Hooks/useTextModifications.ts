import { useChapterReaderSettings } from '@hooks/persisted/useSettings';
import { applyTextModifications } from '@utils/customCode';
import React, { useMemo, useState } from 'react';
import type WebView from 'react-native-webview';
import { WebViewPostEvent } from '../WebViewReader';
import { useNovelSettings } from '@hooks/persisted/useNovelSettings';
import { filterChapterText } from '@screens/reader/utils/filterChapterText';

const EMPTY_FILTERS: string[] = [];
export default function useTextModifications(
  chapterText: string,
  webViewRef: React.RefObject<WebView<object> | null>,
) {
  const { chapterTextFilters = EMPTY_FILTERS } = useNovelSettings();
  // Replace modal state
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [selectedTextForReplace, setSelectedTextForReplace] = useState('');
  const [replacementText, setReplacementText] = useState('');

  const { setChapterReaderSettings, ...readerSettings } =
    useChapterReaderSettings();

  // Live remove/replace actions patch the DOM without reloading the page.
  // When the chapter or novel filters change, rebuild using the latest saved
  // edits so those DOM changes survive the reload.
  const html = useMemo(
    () =>
      filterChapterText(
        applyTextModifications(
          chapterText,
          readerSettings.removeText,
          readerSettings.replaceText,
        ),
        chapterTextFilters,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapterText, chapterTextFilters],
  );

  const injectJS = React.useCallback(
    (script: string) => {
      webViewRef.current?.injectJavaScript(script);
    },
    [webViewRef],
  );
  const handleTextAction = React.useCallback(
    (action: string, text: string) => {
      if (!text) return;

      if (action === 'remove') {
        // Add to removeText array if not already present
        const newRemoveText = [...readerSettings.removeText];
        if (!newRemoveText.includes(text)) {
          newRemoveText.push(text);
          setChapterReaderSettings({ removeText: newRemoveText });
        }
        // Directly remove text in the WebView DOM to avoid full re-render
        injectJS(
          `window.textRemover?.performRemove?.(${JSON.stringify(text)}); true;`,
        );
      } else if (action === 'replace') {
        // Show modal for user to enter replacement text
        setSelectedTextForReplace(text);
        setReplacementText('');
        setReplaceModalVisible(true);
      }
    },
    [readerSettings.removeText, setChapterReaderSettings, injectJS],
  );

  const handleReplaceSave = React.useCallback(() => {
    if (!selectedTextForReplace) return false;

    const newReplaceText = { ...readerSettings.replaceText };
    if (!(selectedTextForReplace in newReplaceText)) {
      newReplaceText[selectedTextForReplace] = replacementText;
      setChapterReaderSettings({ replaceText: newReplaceText });
    }
    // Directly replace text in the WebView DOM to avoid full re-render
    injectJS(
      `window.textRemover?.performReplace?.(${JSON.stringify(
        selectedTextForReplace,
      )}, ${JSON.stringify(replacementText)}); true;`,
    );
    setReplaceModalVisible(false);
    return true;
  }, [
    selectedTextForReplace,
    readerSettings.replaceText,
    replacementText,
    setChapterReaderSettings,
    injectJS,
  ]);

  const handleReplaceCancel = React.useCallback(() => {
    setReplaceModalVisible(false);
    setSelectedTextForReplace('');
    setReplacementText('');
  }, []);

  function eventTextAction(event: WebViewPostEvent) {
    if (event.data) {
      const data = event.data as Record<string, unknown>;
      const action = Object.keys(data)[0];
      const text = data[action];
      handleTextAction(action as string, String(text));
    }
  }

  return {
    html,
    replaceModalVisible,
    setReplaceModalVisible,
    selectedTextForReplace,
    setSelectedTextForReplace,
    replacementText,
    setReplacementText,
    handleReplaceSave,
    handleReplaceCancel,
    eventTextAction,
  };
}
