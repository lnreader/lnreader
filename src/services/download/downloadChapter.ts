import * as cheerio from 'cheerio';
import { NOVEL_STORAGE } from '@utils/Storages';
import { Plugin } from '@plugins/types';
import { downloadFile } from '@plugins/helpers/fetch';
import { getPlugin } from '@plugins/pluginManager';
import { getString } from '@i18n/translations';
import {
  deleteChapter as removeChapterContent,
  getChapter,
} from '@database/queries/ChapterQueries';
import { sleep } from '@utils/sleep';
import {
  APP_SETTINGS,
  AppSettings,
  getChapterDownloadCooldownMs,
} from '@hooks/persisted/useSettings';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { getNovelById } from '@database/queries/NovelQueries';
import { NovelInfo } from '@database/types';
import { dbManager } from '@database/db';
import { chapterSchema } from '@database/schema';
import type {
  BackgroundTaskExecutionContext,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import NativeFile from '@modules/native-file';
import { eq } from 'drizzle-orm';
import { parseDownloadCheckpoint } from './downloadCheckpoint';

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
  await NativeFile.mkdir(chapterFolder);
  const nomediaPath = chapterFolder + '/.nomedia';
  await NativeFile.writeFile(nomediaPath, ',');
  return chapterFolder;
};

const downloadFiles = async (
  html: string,
  plugin: Plugin,
  novelId: number,
  chapterId: number,
): Promise<void> => {
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
  await NativeFile.writeFile(folder + '/index.html', loadedCheerio.html());
};

/**
 * A download can be queued for a chapter that is still unread and then be read
 * online before the task actually runs. The reader's delete-after-read check
 * skips it at that moment because there is nothing on disk yet, so without this
 * the content written by the task would stay forever.
 *
 * Re-reads the chapter rather than trusting the copy fetched before the
 * download, because the read can land while the chapter is being fetched.
 */
const discardIfReadWhileQueued = async (
  chapterId: number,
  novel: NovelInfo,
) => {
  const { autoDeleteReadChapters } =
    getMMKVObject<AppSettings>(APP_SETTINGS) ?? {};
  if (!autoDeleteReadChapters) {
    return;
  }

  const chapter = await getChapter(chapterId);
  if (chapter?.unread) {
    return;
  }

  await removeChapterContent(novel.pluginId, novel.id, chapterId);
};

const downloadChapter = async (chapterId: number) => {
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
  if (!plugin) {
    throw new Error(getString('downloadScreen.pluginNotFound'));
  }
  const chapterText = await plugin.parseChapter(chapter.path);
  if (chapterText && chapterText.length) {
    await downloadFiles(chapterText, plugin, novel.id, chapter.id);

    await dbManager.write(async tx => {
      tx.update(chapterSchema)
        .set({ isDownloaded: true })
        .where(eq(chapterSchema.id, chapter.id))
        .run();
    });

    await discardIfReadWhileQueued(chapter.id, novel);

    await sleep(getChapterDownloadCooldownMs());
  } else {
    throw new Error(getString('downloadScreen.chapterEmptyOrScrapeError'));
  }
};

export const downloadChapters = async (
  {
    chapters,
  }: {
    novelName: string;
    chapters: { chapterId: number; chapterName: string }[];
  },
  setMeta: TaskProgressUpdater,
  context: BackgroundTaskExecutionContext,
) => {
  if (!chapters.length) return;

  const checkpoint = parseDownloadCheckpoint(
    context.checkpoint,
    chapters.length,
  );
  const failures = [...checkpoint.failures];

  for (let index = checkpoint.nextIndex; index < chapters.length; index++) {
    const chapter = chapters[index];
    setMeta(meta => ({
      ...meta,
      isRunning: true,
      progress: index / chapters.length,
      progressText: `${index + 1}/${chapters.length} · ${chapter.chapterName}`,
    }));

    try {
      await downloadChapter(chapter.chapterId);
    } catch (error) {
      failures.push(
        `${chapter.chapterName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await context.updateCheckpoint(
      JSON.stringify({ nextIndex: index + 1, failures }),
    );
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));

  if (failures.length) {
    throw new Error(
      `${failures.length} of ${
        chapters.length
      } chapters failed: ${failures.join('; ')}`,
    );
  }
};
