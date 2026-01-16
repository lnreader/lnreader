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
import { db } from '@database/db';

export interface MigrateNovelData {
  pluginId: string;
  fromNovel: NovelInfo;
  toNovelPath: string;
}

const migrateNovelMetaDataQuery =
  'UPDATE Novel SET cover = ?, summary = ?, author = ?, artist = ?, status = ?, genres = ?, inLibrary = 1  WHERE id = ?';
const migrateChapterQuery =
  'UPDATE Chapter SET bookmark = ?, unread = ?, readTime = ?, progress = ? WHERE id = ?';

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

  await db.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync(
      migrateNovelMetaDataQuery,
      fromNovel.cover || toNovel!.cover || '',
      fromNovel.summary || toNovel!.summary || '',
      fromNovel.author || toNovel!.author || '',
      fromNovel.artist || toNovel!.artist || '',
      fromNovel.status || toNovel!.status || '',
      fromNovel.genres || toNovel!.genres || '',
      toNovel!.id,
    );

    await tx.runAsync(
      'UPDATE OR IGNORE NovelCategory SET novelId = ? WHERE novelId = ?',
      toNovel!.id,
      fromNovel.id,
    );
    await tx.runAsync('DELETE FROM Novel WHERE id = ?', fromNovel.id);
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
    await db.runAsync(
      migrateChapterQuery,
      Number(fromChapter.bookmark),
      Number(fromChapter.unread),
      fromChapter.readTime,
      fromChapter.progress,
      toChapter.id,
    );

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
