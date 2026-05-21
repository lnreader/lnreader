import { useState } from 'react';
import { translateChapterContent } from '@services/translate/TranslationService';
import { saveChapterTranslation, clearChapterTranslation } from '@database/queries/ChapterQueries';
import { useChapterGeneralSettings } from './useSettings';
import { ChapterInfo } from '@database/types';

export function useTranslation() {
  const [translatingIds, setTranslatingIds] = useState<Set<number>>(new Set());
  const { googleTranslateApiKey, translationTargetLang } = useChapterGeneralSettings();

  const translateChapter = async (chapter: ChapterInfo) => {
    if (!googleTranslateApiKey) {
      throw new Error('No API key set. Add one in Reader Settings → Translation.');
    }
    if (!chapter.content) {
      return;
    }
    // Already translated in the target lang — skip (cache hit)
    if (
      chapter.translatedContent &&
      chapter.translationLang === translationTargetLang
    ) {
      return;
    }

    setTranslatingIds(prev => new Set(prev).add(chapter.id));
    try {
      const translated = await translateChapterContent(
        chapter.content,
        translationTargetLang,
        googleTranslateApiKey,
      );
      await saveChapterTranslation(chapter.id, translated, translationTargetLang);
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(chapter.id);
        return next;
      });
    }
  };

  // Bulk translate — called from NovelScreen header action
  const translateChapters = async (chapters: ChapterInfo[]) => {
    // Run sequentially to avoid hammering the API / rate limits
    for (const ch of chapters) {
      await translateChapter(ch).catch(() => {}); // skip failed, continue
    }
  };

  const clearTranslation = async (chapterId: number) => {
    await clearChapterTranslation(chapterId);
  };

  return {
    translatingIds,
    translateChapter,
    translateChapters,
    clearTranslation,
    isTranslating: (id: number) => translatingIds.has(id),
    isAnyTranslating: translatingIds.size > 0,
  };
}
