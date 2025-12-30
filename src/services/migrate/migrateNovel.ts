import { NovelInfo, ChapterInfo } from '@database/types';
import {
  getNovelByPath,
  insertNovelAndChapters,
} from '@database/queries/NovelQueries';
import { getNovelChapters } from '@database/queries/ChapterQueries';

import { fetchNovel } from '@services/plugin/fetch';
import { parseChapterNumber } from '@utils/parseChapterNumber';

import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import {
  LAST_READ_PREFIX,
  NOVEL_SETTINSG_PREFIX,
} from '@hooks/persisted/useNovel';
import { sleep } from '@utils/sleep';
import ServiceManager, {
  BackgroundTaskMetadata,
} from '@services/ServiceManager';
import { dbManager } from '@database/db';
import {
  chapterSchema,
  novelCategorySchema,
  novelSchema,
} from '@database/schema';
import { eq } from 'drizzle-orm';

export interface MigrateNovelData {
  pluginId: string;
  fromNovel: NovelInfo;
  toNovelPath: string;
}

const sortChaptersByNumber = (novelName: string, chapters: ChapterInfo[]) => {
  for (let i = 0; i < chapters.length; ++i) {
    if (!chapters[i].chapterNumber) {
      chapters[i].chapterNumber = parseChapterNumber(
        novelName,
        chapters[i].name,
      );
    }
  }
  return chapters.sort((a, b) => {
    if (a.chapterNumber && b.chapterNumber) {
      return a.chapterNumber - b.chapterNumber;
    }
    return 0;
  });
};

export const migrateNovel = async (
  { pluginId, fromNovel, toNovelPath }: MigrateNovelData,
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
  }));

  let fromChapters = await getNovelChapters(fromNovel.id);
  let toNovel = getNovelByPath(toNovelPath, pluginId);
  let toChapters: ChapterInfo[];
  if (toNovel) {
    toChapters = await getNovelChapters(toNovel.id);
  } else {
    const fetchedNovel = await fetchNovel(pluginId, toNovelPath);
    await insertNovelAndChapters(pluginId, fetchedNovel);
    toNovel = getNovelByPath(toNovelPath, pluginId);
    if (!toNovel) {
      return;
    }
    toChapters = await getNovelChapters(toNovel.id);
  }

  await dbManager.write(async tx => {
    await tx
      .update(novelSchema)
      .set({
        cover: fromNovel.cover || toNovel!.cover || '',
        summary: fromNovel.summary || toNovel!.summary || '',
        author: fromNovel.author || toNovel!.author || '',
        artist: fromNovel.artist || toNovel!.artist || '',
        status: fromNovel.status || toNovel!.status || '',
        genres: fromNovel.genres || toNovel!.genres || '',
        inLibrary: true,
      })
      .where(eq(novelSchema.id, toNovel!.id));
    await tx
      .update(novelCategorySchema)
      .set({
        novelId: toNovel!.id,
      })
      .where(eq(novelCategorySchema.novelId, fromNovel.id));
    await tx.delete(novelSchema).where(eq(novelSchema.id, fromNovel.id));
  });

  setMMKVObject(
    `${NOVEL_SETTINSG_PREFIX}_${toNovel!.pluginId}_${toNovel!.path}`,
    getMMKVObject(
      `${NOVEL_SETTINSG_PREFIX}_${fromNovel.pluginId}_${fromNovel.path}`,
    ),
  );

  const lastRead = getMMKVObject<NovelInfo>(
    `${LAST_READ_PREFIX}_${fromNovel.pluginId}_${fromNovel.path}`,
  );

  const setLastRead = (chapter: ChapterInfo) => {
    setMMKVObject(
      `${LAST_READ_PREFIX}_${toNovel!.pluginId}_${toNovel!.path}`,
      chapter,
    );
  };

  fromChapters = sortChaptersByNumber(fromNovel.name, fromChapters);
  toChapters = sortChaptersByNumber(toNovel.name, toChapters);

  let fromPointer = 0,
    toPointer = 0;
  while (fromPointer < fromChapters.length && toPointer < toChapters.length) {
    const fromChapter = fromChapters[fromPointer];
    const toChapter = toChapters[toPointer];
    if (fromChapter.chapterNumber && toChapter.chapterNumber) {
      if (fromChapter.chapterNumber < toChapter.chapterNumber) {
        ++fromPointer;
        continue;
      }
      if (fromChapter.chapterNumber > toChapter.chapterNumber) {
        ++toPointer;
        continue;
      }
    } else {
      ++fromPointer;
      ++toPointer;
      continue;
    }

    await dbManager.write(async tx => {
      await tx
        .update(chapterSchema)
        .set({
          bookmark: fromChapter.bookmark,
          unread: fromChapter.unread,
          readTime: fromChapter.readTime,
          progress: fromChapter.progress,
        })
        .where(eq(chapterSchema.id, toChapter.id));
    });

    if (fromChapter.isDownloaded) {
      ServiceManager.manager.addTask({
        name: 'DOWNLOAD_CHAPTER',
        data: {
          chapterId: toChapter.id,
          novelName: toNovel.name,
          chapterName: toChapter.name,
        },
      });
      await sleep(1000);
    }

    if (lastRead && fromChapter.id === lastRead.id) {
      setLastRead(toChapter);
    }

    ++fromPointer;
    ++toPointer;
  }

  setMeta(meta => ({
    ...meta,
    isRunning: false,
  }));
};
