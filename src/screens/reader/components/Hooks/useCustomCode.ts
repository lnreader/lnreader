import { ChapterReaderSettings } from '@hooks/persisted/useSettings';
import { useMemo } from 'react';
import { composeCSS, composeJS } from '@utils/customCode';

export default function useCustomCode(
  readerSettings: Pick<
    ChapterReaderSettings,
    'codeSnippetsJS' | 'codeSnippetsCSS'
  >,
) {
  const customJS = useMemo(
    () => composeJS(readerSettings.codeSnippetsJS),
    [readerSettings.codeSnippetsJS],
  );

  const customCSS = useMemo(
    () => composeCSS(readerSettings.codeSnippetsCSS),
    [readerSettings.codeSnippetsCSS],
  );

  return {
    customJS,
    customCSS,
  };
}
