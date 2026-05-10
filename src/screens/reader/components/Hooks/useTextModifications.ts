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
    const validFlags = new Set(['g', 'm', 'i', 'y', 'u', 'v', 's', 'd']);
    readerSettings.removeText.forEach(text => {
      // test if text is regex
      const m = text.match(/^\/(.*)\/([gmiyuvsd]*)$/);
      if (m) {
        const flags = m[2] ?? '';
        const hasInvalidFlags = [...flags].some(f => !validFlags.has(f));
        if (hasInvalidFlags) {
          console.warn('Invalid regex flags in removeText:', text);
          return;
        }
        try {
          const regex = new RegExp(m[1], flags);
          chText = chText.replace(regex, '');
        } catch (e) {
          console.warn('Invalid regex pattern in removeText:', text);
        }
      } else {
        chText = chText.split(text).join('');
      }
    });
    Object.entries(readerSettings.replaceText).forEach(
      ([text, replacement]) => {
        const m = text.match(/^\/(.*)\/([gmiyuvsd]*)$/);
        if (m) {
          const flags = m[2] ?? '';
          const hasInvalidFlags = [...flags].some(f => !validFlags.has(f));
          if (hasInvalidFlags) {
            console.warn('Invalid regex flags in replaceText:', text);
            return;
          }
          try {
            const regex = new RegExp(m[1], flags);
            chText = chText.replace(regex, replacement);
          } catch (e) {
            console.warn('Invalid regex pattern in replaceText:', text);
          }
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
