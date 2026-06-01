import * as cheerio from 'cheerio';
import { NOVEL_STORAGE } from '@utils/Storages';
import { Plugin } from '@plugins/types';
import { downloadFile } from '@plugins/helpers/fetch';
import { getPlugin } from '@plugins/pluginManager';
import { getString } from '@strings/translations';
import { getChapter } from '@database/queries/ChapterQueries';
import { sleep } from '@utils/sleep';
import { getNovelById } from '@database/queries/NovelQueries';
import { dbManager } from '@database/db';
import { chapterSchema } from '@database/schema';
import { BackgroundTaskMetadata } from '@services/ServiceManager';
import NativeFile from '@specs/NativeFile';
import { eq } from 'drizzle-orm';
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
  TranslateProviderConfig,
} from '@utils/translate';

const createChapterFolder = async (
  path: string,
  data: {
    pluginId: string;
    novelId: number;
    chapterId: number;
  },
): Promise<string> => {
  const { pluginId, novelId, chapterId } = data;
  const chapterFolder = `${path}/${pluginId}/${novelId}/${chapterId}`;
  NativeFile.mkdir(chapterFolder);
  const nomediaPath = chapterFolder + '/.nomedia';
  NativeFile.writeFile(nomediaPath, ',');
  return chapterFolder;
};

const downloadFiles = async (
  html: string,
  plugin: Plugin,
  novelId: number,
  chapterId: number,
): Promise<string> => {
  const folder = await createChapterFolder(NOVEL_STORAGE, {
    pluginId: plugin.id,
    novelId,
    chapterId,
  });
  const loadedCheerio = cheerio.load(html);
  const imgs = loadedCheerio('img').toArray();
  for (let i = 0; i < imgs.length; i++) {
    const elem = loadedCheerio(imgs[i]);
    const url = elem.attr('src');
    if (url) {
      const fileurl = `${folder}/${i}.b64.png`;
      elem.attr('src', 'file://' + fileurl);
      try {
        const absoluteURL = new URL(url, plugin.site).href;
        await downloadFile(absoluteURL, fileurl, plugin.imageRequestInit);
      } catch (e) {
        elem.attr('alt', String(e));
      }
    }
  }
  const offlineHtml = loadedCheerio.html();
  NativeFile.writeFile(folder + '/index.html', offlineHtml);
  return offlineHtml;
};

export const downloadChapter = async (
  { chapterId }: { chapterId: number },
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
  }));

  const chapter = await getChapter(chapterId);
  if (!chapter) {
    throw new Error('Chapter not found with id: ' + chapterId);
  }
  if (chapter.isDownloaded) {
    return;
  }
  const novel = await getNovelById(chapter.novelId);
  if (!novel) {
    throw new Error('Novel not found for chapter: ' + chapter.name);
  }
  const plugin = getPlugin(novel.pluginId);

  let chapterText = '';
  if (novel.pluginId === 'local') {
    const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`;
    if (NativeFile.exists(filePath)) {
      chapterText = NativeFile.readFile(filePath);
    }
  } else {
    if (!plugin) {
      throw new Error(getString('downloadScreen.pluginNotFound'));
    }
    chapterText = await plugin.parseChapter(chapter.path);
  }

  if (chapterText && chapterText.length) {
    const translateSettings =
      getMMKVObject<TranslateSettings>(TRANSLATE_SETTINGS) ??
      initialTranslateSettings;

    let offlineHtml = chapterText;
    if (plugin) {
      offlineHtml = await downloadFiles(
        chapterText,
        plugin,
        novel.id,
        chapter.id,
      );
    }

    if (translateSettings.translateEnabled) {
      try {
        // Build provider config
        const providerId = translateSettings.translateProvider ?? 'gtx';
        const apiKey = getProviderApiKey(providerId);
        const extra: Record<string, string> = {};
        if (providerId === 'deepl') {
          extra.plan = translateSettings.deeplPlan ?? 'free';
        } else if (
          providerId === 'microsoft' &&
          translateSettings.microsoftRegion
        ) {
          extra.region = translateSettings.microsoftRegion;
        }
        const providerConfig: TranslateProviderConfig = {
          providerId,
          apiKey,
          extra,
        };

        const modes: ('dual' | 'translated')[] = ['dual', 'translated'];
        for (const mode of modes) {
          const translatedHtml = await translateHtml(
            offlineHtml,
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
      } catch {}
    }

    await dbManager.write(async tx => {
      tx.update(chapterSchema)
        .set({ isDownloaded: true })
        .where(eq(chapterSchema.id, chapter.id))
        .run();
    });

    await sleep(1000);
  } else {
    throw new Error(getString('downloadScreen.chapterEmptyOrScrapeError'));
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));
};
