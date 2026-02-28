import { ChapterReaderSettings } from '@hooks/persisted/useSettings';
import { useMemo } from 'react';

export default function useCustomCode(
  readerSettings: Pick<
    ChapterReaderSettings,
    'codeSnippetsJS' | 'codeSnippetsCSS'
  >,
) {
  const customJS = useMemo(() => {
    return readerSettings.codeSnippetsJS
      .map(snippet => {
        if (!snippet.active) return null;
        return `
        try {
           ${snippet.code}
        } catch (error) {
          alert(\`Error loading executing ${snippet.name}:\n\` + error);
        }
        `;
      })
      .filter(Boolean)
      .join('\n');
  }, [readerSettings.codeSnippetsJS]);

  const customCSS = useMemo(() => {
    return readerSettings.codeSnippetsCSS
      .map(snippet => {
        if (!snippet.active) return null;
        return snippet.code;
      })
      .filter(Boolean)
      .join('\n');
  }, [readerSettings.codeSnippetsCSS]);

  return {
    customJS,
    customCSS,
  };
}
