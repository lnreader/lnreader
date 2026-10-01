import { useCallback } from 'react';
import { useChapterReaderSettings } from '@hooks/persisted';
import type { NativeToWebMessage } from '../../engine/protocol';

// Saved rules apply to every chapter as it loads; the edit is also applied to
// the open pages directly, so the reader keeps its place.
export default function useTextModifications(
  send: (message: NativeToWebMessage) => void,
  onApplied: () => void,
) {
  const {
    removeText: removed,
    replaceText: replaced,
    setChapterReaderSettings,
  } = useChapterReaderSettings();

  const removeText = useCallback(
    (text: string) => {
      if (!removed.includes(text)) {
        setChapterReaderSettings({ removeText: [...removed, text] });
      }
      send({ type: 'text-edit', action: 'remove', text });
      onApplied();
    },
    [onApplied, removed, send, setChapterReaderSettings],
  );

  const replaceText = useCallback(
    (text: string, replacement: string) => {
      if (!(text in replaced)) {
        setChapterReaderSettings({
          replaceText: { ...replaced, [text]: replacement },
        });
      }
      send({ type: 'text-edit', action: 'replace', text, replacement });
      onApplied();
    },
    [onApplied, replaced, send, setChapterReaderSettings],
  );

  return { removeText, replaceText };
}
