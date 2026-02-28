import { useChapterReaderSettings } from '@hooks/persisted/useSettings';
import React, { useMemo, useState } from 'react';
import { WebViewPostEvent } from '../WebViewReader';

export default function useTextModifications(chapterText: string) {
  // Replace modal state
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [selectedTextForReplace, setSelectedTextForReplace] = useState('');
  const [replacementText, setReplacementText] = useState('');

  const { setChapterReaderSettings, ...readerSettings } =
    useChapterReaderSettings();

  const html = useMemo(() => {
    let chText = chapterText;
    readerSettings.removeText.forEach(text => {
      // test if text is regex
      const m = text.match(/^\/(.*)\/([gmiyuvsd]*)$/);
      if (m) {
        const regex = new RegExp(m[1], m[2] ?? '');
        chText = chText.replace(regex, '');
      } else {
        chText = chText.split(text).join('');
      }
    });
    Object.entries(readerSettings.replaceText).forEach(
      ([text, replacement]) => {
        const m = text.match(/^\/(.*)\/([gmiyuvsd]*)$/);
        if (m) {
          const regex = new RegExp(m[1], m[2] ?? '');
          chText = chText.replace(regex, replacement);
        } else {
          chText = chText.split(text).join(replacement);
        }
      },
    );
    return chText;
  }, [chapterText, readerSettings.removeText, readerSettings.replaceText]);

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
      } else if (action === 'replace') {
        // Show modal for user to enter replacement text
        setSelectedTextForReplace(text);
        setReplacementText('');
        setReplaceModalVisible(true);
      }
    },
    [readerSettings.removeText, setChapterReaderSettings],
  );

  const handleReplaceSave = React.useCallback(() => {
    if (!selectedTextForReplace) return false;

    const newReplaceText = { ...readerSettings.replaceText };
    if (!(selectedTextForReplace in newReplaceText)) {
      newReplaceText[selectedTextForReplace] = replacementText;
      setChapterReaderSettings({ replaceText: newReplaceText });
    }
    setReplaceModalVisible(false);
    return true;
  }, [
    selectedTextForReplace,
    readerSettings.replaceText,
    replacementText,
    setChapterReaderSettings,
  ]);

  const handleReplaceCancel = React.useCallback(() => {
    setReplaceModalVisible(false);
    setSelectedTextForReplace('');
    setReplacementText('');
  }, []);

  function eventTextAction(event: WebViewPostEvent) {
    if (event.data) {
      const action = Object.keys(event.data)[0];
      const text = event.data[action];
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
