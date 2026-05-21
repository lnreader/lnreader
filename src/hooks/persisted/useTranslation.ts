import { useState } from 'react';
import { translateChapterContent } from '@services/translate/TranslationService';
import { saveChapterTranslation, clearChapterTranslation } from '@database/queries/ChapterQueries';
import { getNovelById } from '@database/queries/NovelQueries';
import { fetchChapter } from '@services/plugin/fetch';
import { useChapterGeneralSettings } from './useSettings';
import { ChapterInfo } from '@database/types';
import NativeFile from '@specs/NativeFile';
import { NOVEL_STORAGE } from '@utils/Storages';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { useNovelActions, useNovelValue } from '@screens/novel/NovelContext';

export function useTranslation() {
  const [translatingIds, setTranslatingIds] = useState<Set<number>>(new Set());
  const { googleTranslateApiKey, translationTargetLang } = useChapterGeneralSettings();

  const { updateChapter } = useNovelActions();
  const chapters = useNovelValue('chapters');

  const translateChapter = async (chapter: ChapterInfo) => {
    if (!googleTranslateApiKey) {
      const msg = getString('common.noApiKey') || 'No API key set. Add one in Reader Settings → Translation.';
      showToast(msg);
      throw new Error(msg);
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
      let rawContent = '';
      const novel = getNovelById(chapter.novelId);
      if (!novel) {
        throw new Error('Novel not found in database');
      }

      const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${chapter.novelId}/${chapter.id}/index.html`;
      if (chapter.isDownloaded && NativeFile.exists(filePath)) {
        rawContent = NativeFile.readFile(filePath);
      } else {
        rawContent = await fetchChapter(novel.pluginId, chapter.path);
      }

      if (!rawContent) {
        throw new Error('Chapter content is empty');
      }

      const translated = await translateChapterContent(
        rawContent,
        translationTargetLang,
        googleTranslateApiKey,
      );

      await saveChapterTranslation(chapter.id, translated, translationTargetLang);

      const index = chapters.findIndex(c => c.id === chapter.id);
      if (index !== -1) {
        updateChapter(index, {
          translatedContent: translated,
          translationLang: translationTargetLang,
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
  };

  // Bulk translate — called from NovelScreen header action
  const translateChapters = async (chaptersToTranslate: ChapterInfo[]) => {
    for (const ch of chaptersToTranslate) {
      await translateChapter(ch).catch(() => {}); // skip failed, continue
    }
  };

  const clearTranslation = async (chapterId: number) => {
    await clearChapterTranslation(chapterId);
    const index = chapters.findIndex(c => c.id === chapterId);
    if (index !== -1) {
      updateChapter(index, {
        translatedContent: null,
        translationLang: null,
      });
    }
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

