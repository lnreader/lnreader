import { useState, useCallback } from 'react';
import { translateChapterContent, ProviderConfig } from '@services/translation';
import {
  saveChapterTranslation,
  clearChapterTranslation,
} from '@database/queries/ChapterQueries';
import { useChapterGeneralSettings } from './useSettings';
import { ChapterInfo, NovelInfo } from '@database/types';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { useNovelActions, useNovelValue } from '@screens/novel/NovelContext';

export function useTranslation() {
  const [translatingIds, setTranslatingIds] = useState<Set<number>>(new Set());
  const settings = useChapterGeneralSettings();

  const { updateChapter } = useNovelActions();
  const chapters = useNovelValue('chapters');

  const translateChapter = useCallback(
    async (chapter: ChapterInfo, novel: NovelInfo) => {
      const targetLang = novel.translationLang || 'en';

      // Cache hit — already translated into the current target lang
      if (chapter.translatedContent && chapter.translationLang === targetLang) {
        return;
      }

      setTranslatingIds(prev => new Set(prev).add(chapter.id));
      try {
        const config: ProviderConfig = {
          googleApiKey: settings.googleApiKey,
          deeplApiKey: settings.deeplApiKey,
          deeplPlan: settings.deeplPlan,
          microsoftApiKey: settings.microsoftApiKey,
          microsoftRegion: settings.microsoftRegion,
        };

        const translated = await translateChapterContent(
          chapter.content || '',
          targetLang,
          settings.translationProvider,
          config,
        );
        await saveChapterTranslation(chapter.id, translated, targetLang);

        const index = chapters.findIndex(c => c.id === chapter.id);
        if (index !== -1) {
          updateChapter(index, {
            translatedContent: translated,
            translationLang: targetLang,
          });
        }
        showToast(getString('common.translated') || 'Chapter translated!');
      } catch (error: any) {
        const errorMsg = error?.message || 'Translation failed';
        showToast(
          getString('common.translationFailed', { error: errorMsg }) ||
            `Translation failed: ${errorMsg}`,
        );
        throw error;
      } finally {
        setTranslatingIds(prev => {
          const next = new Set(prev);
          next.delete(chapter.id);
          return next;
        });
      }
    },
    [settings, chapters, updateChapter],
  );

  // Sequential to avoid hammering the API
  const translateChapters = useCallback(
    async (chaptersToTranslate: ChapterInfo[], novel: NovelInfo) => {
      for (const ch of chaptersToTranslate) {
        await translateChapter(ch, novel).catch(() => {});
      }
    },
    [translateChapter],
  );

  const clearTranslation = useCallback(
    async (chapterId: number) => {
      await clearChapterTranslation(chapterId);
      const index = chapters.findIndex(c => c.id === chapterId);
      if (index !== -1) {
        updateChapter(index, {
          translatedContent: null,
          translationLang: null,
        });
      }
    },
    [chapters, updateChapter],
  );

  return {
    translatingIds,
    translateChapter,
    translateChapters,
    clearTranslation,
    isTranslating: (id: number) => translatingIds.has(id),
    isAnyTranslating: translatingIds.size > 0,
  };
}
