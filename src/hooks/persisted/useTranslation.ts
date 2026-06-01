import { useState, useCallback, useRef } from 'react';
import { useMMKVString } from 'react-native-mmkv';
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
import { NOVEL_STORAGE } from '@utils/Storages';
import { SecureMMKVStorage } from '@utils/mmkv/mmkv';
import NativeFile from '@specs/NativeFile';

export function useTranslation() {
  const [translatingIds, setTranslatingIds] = useState<Set<number>>(new Set());
  const settings = useChapterGeneralSettings();
  const provider = settings.translationConfig.provider;
  const apiKeyName =
    provider === 'google' ? 'googleApiKey'
    : provider === 'deepl' ? 'deeplApiKey'
    : provider === 'microsoft' ? 'microsoftApiKey'
    : null;
  const [apiKey = ''] = useMMKVString(apiKeyName ?? '__unused__', SecureMMKVStorage);

  const { updateChapter } = useNovelActions();
  const chapters = useNovelValue('chapters');

  // Keep a ref to the latest chapters array to avoid stale closures in the async loop
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;

  const translateChapter = useCallback(
    async (chapter: ChapterInfo, novel: NovelInfo, targetLanguage?: string, silent = false) => {
      const targetLang = targetLanguage || 'en';

      // Cache hit — already translated into the current target lang
      const transPath = `${NOVEL_STORAGE}/${novel.pluginId}/${chapter.novelId}/${chapter.id}/translation_${targetLang}.html`;
      if (NativeFile.exists(transPath)) {
        return;
      }

      setTranslatingIds(prev => new Set(prev).add(chapter.id));
      try {
        let content = chapter.content || '';
        if (!content && chapter.isDownloaded) {
          const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${chapter.novelId}/${chapter.id}/index.html`;
          if (NativeFile.exists(filePath)) {
            content = NativeFile.readFile(filePath);
          }
        }

        if (!content) {
          throw new Error('Chapter content is empty or not downloaded');
        }

        const config: ProviderConfig =
          settings.translationConfig.provider === 'deepl'
            ? { deeplApiKey: apiKey, deeplPlan: settings.translationConfig.plan }
            : settings.translationConfig.provider === 'microsoft'
            ? { microsoftApiKey: apiKey, microsoftRegion: settings.translationConfig.region }
            : settings.translationConfig.provider === 'google'
            ? { googleApiKey: apiKey }
            : {};

        const translated = await translateChapterContent(
          content,
          targetLang,
          settings.translationConfig.provider,
          config,
        );
        await saveChapterTranslation(chapter.id, translated, targetLang);

        const latestChapters = chaptersRef.current;
        const index = latestChapters.findIndex(c => c.id === chapter.id);
        if (index !== -1) {
          updateChapter(index, {
            translationLang: targetLang,
          });
        }
        if (!silent) {
          showToast(getString('common.translated') || 'Chapter translated!');
        }
      } catch (error: any) {
        const errorMsg = error?.message || 'Translation failed';
        if (!silent) {
          showToast(
            getString('common.translationFailed', { error: errorMsg }) ||
              `Translation failed: ${errorMsg}`,
          );
        }
        throw error;
      } finally {
        setTranslatingIds(prev => {
          const next = new Set(prev);
          next.delete(chapter.id);
          return next;
        });
      }
    },
    [settings, apiKey, updateChapter],
  );

  // Sequential to avoid hammering the API
  const translateChapters = useCallback(
    async (chaptersToTranslate: ChapterInfo[], novel: NovelInfo, targetLanguage?: string) => {
      let successCount = 0;
      let failCount = 0;
      for (const ch of chaptersToTranslate) {
        try {
          await translateChapter(ch, novel, targetLanguage, true);
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) {
        showToast(
          getString('common.bulkTranslated', { count: successCount }) ||
            `Translated ${successCount} chapters!`
        );
      } else if (failCount > 0) {
        showToast(
          getString('common.bulkTranslationFailed') || 'Bulk translation failed'
        );
      }
    },
    [translateChapter],
  );

  const clearTranslation = useCallback(
    async (chapterId: number) => {
      await clearChapterTranslation(chapterId);
      const latestChapters = chaptersRef.current;
      const index = latestChapters.findIndex(c => c.id === chapterId);
      if (index !== -1) {
        updateChapter(index, {
          translationLang: null,
        });
      }
    },
    [updateChapter],
  );

  const clearAllTranslations = useCallback(
    async (chaptersToClear: ChapterInfo[]) => {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        for (const ch of chaptersToClear) {
          next.add(ch.id);
        }
        return next;
      });

      try {
        for (const ch of chaptersToClear) {
          await clearChapterTranslation(ch.id).catch(() => {});
          const latestChapters = chaptersRef.current;
          const index = latestChapters.findIndex(c => c.id === ch.id);
          if (index !== -1) {
            updateChapter(index, {
              translationLang: null,
            });
          }
        }
        showToast(getString('common.translationsCleared') || 'All translations cleared!');
      } catch {
        showToast('Failed to clear translations');
      } finally {
        setTranslatingIds(prev => {
          const next = new Set(prev);
          for (const ch of chaptersToClear) {
            next.delete(ch.id);
          }
          return next;
        });
      }
    },
    [updateChapter],
  );

  return {
    translatingIds,
    translateChapter,
    translateChapters,
    clearTranslation,
    clearAllTranslations,
    isTranslating: (id: number) => translatingIds.has(id),
    isAnyTranslating: translatingIds.size > 0,
  };
}
