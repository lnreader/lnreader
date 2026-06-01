import { NOVEL_STORAGE } from '@utils/Storages';
import { getPlugin } from '@plugins/pluginManager';
import { getString } from '@strings/translations';
import { getChapter } from '@database/queries/ChapterQueries';
import { getNovelById } from '@database/queries/NovelQueries';
import { BackgroundTaskMetadata } from '@services/ServiceManager';
import NativeFile from '@specs/NativeFile';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import {
  TRANSLATE_SETTINGS,
  TranslateSettings,
  initialTranslateSettings,
  getProviderApiKey,
} from '@hooks/persisted/useTranslateSettings';
import {
  translateHtml,
  saveTranslationToCache,
  getCachedTranslation,
  TranslateProviderConfig,
} from '@utils/translate';

export const translateNovel = async (
  { novelId, chapterIds }: { novelId: number; chapterIds: number[] },
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
  }));

  const novel = await getNovelById(novelId);
  if (!novel) {
    throw new Error('Novel not found: ' + novelId);
  }

  const translateSettings =
    getMMKVObject<TranslateSettings>(TRANSLATE_SETTINGS) ??
    initialTranslateSettings;
  if (!translateSettings.translateEnabled) {
    throw new Error('Translation is not enabled in settings.');
  }

  const plugin = getPlugin(novel.pluginId);

  // Build provider config
  const providerId = translateSettings.translateProvider ?? 'gtx';
  const apiKey = getProviderApiKey(providerId);
  const extra: Record<string, string> = {};
  if (providerId === 'deepl') {
    extra.plan = translateSettings.deeplPlan ?? 'free';
  } else if (providerId === 'microsoft' && translateSettings.microsoftRegion) {
    extra.region = translateSettings.microsoftRegion;
  }
  const providerConfig: TranslateProviderConfig = { providerId, apiKey, extra };

  let completedCount = 0;
  const total = chapterIds.length;

  const CONCURRENCY = 8;
  for (let c = 0; c < total; c += CONCURRENCY) {
    const batch = chapterIds.slice(c, c + CONCURRENCY);

    await Promise.allSettled(
      batch.map(async (chapterId, batchIdx) => {
        const i = c + batchIdx;

        const chapter = await getChapter(chapterId);
        if (!chapter) {
          completedCount++;
          return;
        }

        const modes: ('dual' | 'translated')[] = ['dual', 'translated'];

        let allCached = true;
        for (const mode of modes) {
          const cached = getCachedTranslation(
            chapter.id,
            translateSettings.translateTargetLanguage,
            mode,
            translateSettings.translateColor,
            translateSettings.translateItalic,
            translateSettings.translateUnderline,
          );
          if (!cached) {
            allCached = false;
            break;
          }
        }

        if (allCached) {
          completedCount++;
          setMeta(meta => ({
            ...meta,
            progress: completedCount / total,
            progressText: getString('notifications.TRANSLATE_NOVEL_PROGRESS', {
              current: completedCount,
              total,
            }),
          }));
          return;
        }

        let chapterText = '';
        if (novel.pluginId === 'local') {
          const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`;
          if (NativeFile.exists(filePath)) {
            chapterText = NativeFile.readFile(filePath);
          }
        } else {
          if (!chapter.isDownloaded) {
            completedCount++;
            return;
          }
          const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`;
          if (NativeFile.exists(filePath)) {
            chapterText = NativeFile.readFile(filePath);
          } else if (plugin) {
            chapterText = await plugin.parseChapter(chapter.path);
          }
        }

        if (!chapterText || chapterText.length === 0) {
          completedCount++;
          return;
        }

        try {
          for (const mode of modes) {
            if (
              getCachedTranslation(
                chapter.id,
                translateSettings.translateTargetLanguage,
                mode,
                translateSettings.translateColor,
                translateSettings.translateItalic,
                translateSettings.translateUnderline,
              )
            ) {
              continue;
            }

            const translatedHtml = await translateHtml(
              chapterText,
              translateSettings.translateTargetLanguage,
              mode,
              {
                color: translateSettings.translateColor,
                italic: translateSettings.translateItalic,
                underline: translateSettings.translateUnderline,
              },
              providerConfig,
            );

            saveTranslationToCache(
              chapter.id,
              translateSettings.translateTargetLanguage,
              mode,
              translateSettings.translateColor,
              translateSettings.translateItalic,
              translateSettings.translateUnderline,
              translatedHtml,
            );
          }
        } catch {
          throw new Error(
            `Translation stopped at chapter ${i + 1} due to network error.`,
          );
        } finally {
          completedCount++;
          setMeta(meta => ({
            ...meta,
            progress: completedCount / total,
            progressText: getString('notifications.TRANSLATE_NOVEL_PROGRESS', {
              current: completedCount,
              total,
            }),
          }));
        }
      }),
    );
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    progressText: getString('notifications.TRANSLATE_NOVEL_COMPLETE'),
    isRunning: false,
  }));
};
