import { fetchNovel, fetchPage } from '../plugin/fetch';
import { ChapterItem, PageOrder, SourceNovel } from '@plugins/types';
import {
  getPlugin,
  getPluginPageOrder,
  LOCAL_PLUGIN_ID,
} from '@plugins/pluginManager';
import { NOVEL_STORAGE } from '@utils/Storages';
import { downloadFile } from '@plugins/helpers/fetch';
import type { BackgroundTaskEnqueuer } from '@services/backgroundTasks/contracts';
import { dbManager } from '@database/db';
import { novelSchema, chapterSchema } from '@database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import NativeFile from '@modules/native-file';
import {
  insertChapters,
  resequenceNovelChapters,
} from '@database/queries/ChapterQueries';

/**
 * Update novel metadata in the database including cover image.
 */
const updateNovelMetadata = async (
  pluginId: string,
  novelId: number,
  novel: SourceNovel,
) => {
  const { name, summary, author, artist, genres, status, totalPages } = novel;
  let cover = novel.cover;
  const novelDir = `${NOVEL_STORAGE}/${pluginId}/${novelId}`;

  if (!(await NativeFile.exists(novelDir))) {
    await NativeFile.mkdir(novelDir);
  }

  if (cover) {
    const novelCoverPath = `${novelDir}/cover.png`;
    const novelCoverUri = `file://${novelCoverPath}`;
    try {
      await downloadFile(
        cover,
        novelCoverPath,
        getPlugin(pluginId)?.imageRequestInit,
      );
      cover = `${novelCoverUri}?${Date.now()}`;
    } catch {
      // If download fails, we fallback to what was there or null
      cover = undefined;
    }
  }

  await dbManager.write(async tx => {
    await tx
      .update(novelSchema)
      .set({
        name,
        cover: cover || null,
        summary: summary || null,
        author: author || 'unknown',
        artist: artist || null,
        genres: genres || null,
        status: status || null,
        totalPages: totalPages || 0,
      })
      .where(eq(novelSchema.id, novelId))
      .run();
  });
};

/**
 * Update only the total pages count for a novel.
 */
const updateNovelTotalPages = async (novelId: number, totalPages: number) => {
  await dbManager.write(async tx => {
    await tx
      .update(novelSchema)
      .set({ totalPages })
      .where(eq(novelSchema.id, novelId))
      .run();
  });
};

/**
 * Update or insert chapters for a novel.
 * Distinguishes between new chapters (triggers download) and existing chapters (updates metadata).
 */
const updateNovelChapters = async (
  pluginId: string,
  novelName: string,
  novelId: number,
  chapters: ChapterItem[],
  downloadNewChapters?: boolean,
  page?: string,
  enqueue?: BackgroundTaskEnqueuer,
): Promise<number> => {
  if (!chapters.length) {
    return 0;
  }

  const incomingPaths = Array.from(
    new Set(chapters.map(chapter => chapter.path)),
  );
  const existingChapters = incomingPaths.length
    ? await dbManager
        .select({ path: chapterSchema.path })
        .from(chapterSchema)
        .where(
          and(
            eq(chapterSchema.novelId, novelId),
            inArray(chapterSchema.path, incomingPaths),
          ),
        )
        .all()
    : [];

  const existingPathSet = new Set(
    existingChapters.map(chapter => chapter.path),
  );
  const newPaths = incomingPaths.filter(path => !existingPathSet.has(path));

  await insertChapters(novelId, chapters, {
    page,
    touchUpdatedTime: true,
    // updateNovel rebuilds reading order once, after every page has landed.
    deferResequence: true,
  });

  if (downloadNewChapters && newPaths.length && enqueue) {
    const insertedNewChapters = await dbManager
      .select({
        id: chapterSchema.id,
        path: chapterSchema.path,
        name: chapterSchema.name,
      })
      .from(chapterSchema)
      .where(
        and(
          eq(chapterSchema.novelId, novelId),
          inArray(chapterSchema.path, newPaths),
        ),
      )
      .all();

    const chapterNameByPath = new Map(
      chapters.map((chapter, index) => [
        chapter.path,
        chapter.name || `Chapter ${index + 1}`,
      ]),
    );

    if (insertedNewChapters.length) {
      enqueue({
        name: 'DOWNLOAD_CHAPTER',
        data: {
          novelName,
          novelId,
          pluginId,
          chapters: insertedNewChapters.map(insertedChapter => ({
            chapterId: insertedChapter.id,
            chapterName:
              chapterNameByPath.get(insertedChapter.path) ||
              insertedChapter.name,
          })),
        },
      });
    }
  }

  return newPaths.length;
};

export interface UpdateNovelOptions {
  downloadNewChapters?: boolean;
  refreshNovelMetadata?: boolean;
  enqueue?: BackgroundTaskEnqueuer;
}

const getStoredTotalPages = async (novelId: number): Promise<number> => {
  const result = await dbManager
    .select({ totalPages: novelSchema.totalPages })
    .from(novelSchema)
    .where(eq(novelSchema.id, novelId))
    .get();

  return result?.totalPages ?? 0;
};

/**
 * Fetch every page of a paginated novel and write it back.
 *
 * Used for DESC sources once a new chapter is known to exist: publishing a
 * chapter there shifts every later chapter onto a different page, so reading
 * order can only be re-derived from a complete, self-consistent snapshot of
 * the source's pagination.
 */
const refetchAllPages = async (
  pluginId: string,
  novelPath: string,
  novelName: string,
  novelId: number,
  totalPages: number,
  fromPage: number,
  downloadNewChapters: boolean | undefined,
  enqueue: BackgroundTaskEnqueuer | undefined,
) => {
  for (let page = fromPage; page <= totalPages; page++) {
    try {
      const sourcePage = await fetchPage(pluginId, novelPath, String(page));
      await updateNovelChapters(
        pluginId,
        novelName,
        novelId,
        sourcePage.chapters || [],
        downloadNewChapters,
        String(page),
        enqueue,
      );
    } catch {}
  }
};

/**
 * Main function to update a novel's metadata and chapters.
 */
const updateNovel = async (
  pluginId: string,
  novelPath: string,
  novelId: number,
  options: UpdateNovelOptions,
) => {
  if (pluginId === LOCAL_PLUGIN_ID) {
    return;
  }
  const { downloadNewChapters, refreshNovelMetadata, enqueue } = options;
  const pageOrder: PageOrder = getPluginPageOrder(pluginId);

  const oldTotalPages = await getStoredTotalPages(novelId);

  const novel = await fetchNovel(pluginId, novelPath);

  if (refreshNovelMetadata) {
    await updateNovelMetadata(pluginId, novelId, novel);
  } else if (novel.totalPages) {
    await updateNovelTotalPages(novelId, novel.totalPages);
  }

  // parseNovel returns the source's first page, which is where a DESC source
  // publishes new chapters.
  const newOnFirstPage = await updateNovelChapters(
    pluginId,
    novel.name,
    novelId,
    novel.chapters || [],
    downloadNewChapters,
    undefined,
    enqueue,
  );

  const totalPages = novel.totalPages ?? 0;
  if (totalPages > 1 && getPlugin(pluginId)?.parsePage) {
    if (pageOrder === 'DESC') {
      // Page 1 holds the newest chapters, so it alone decides whether
      // anything was published. When nothing was, this costs no extra
      // requests at all.
      if (newOnFirstPage > 0) {
        await refetchAllPages(
          pluginId,
          novelPath,
          novel.name,
          novelId,
          totalPages,
          2,
          downloadNewChapters,
          enqueue,
        );
      }
    } else {
      // ASC: a chapter's page never changes, so only the tail can move.
      if (oldTotalPages > 1) {
        try {
          const sourcePage = await fetchPage(
            pluginId,
            novelPath,
            String(oldTotalPages),
          );
          await updateNovelChapters(
            pluginId,
            novel.name,
            novelId,
            sourcePage.chapters || [],
            downloadNewChapters,
            String(oldTotalPages),
            enqueue,
          );
        } catch {}
      }

      await refetchAllPages(
        pluginId,
        novelPath,
        novel.name,
        novelId,
        totalPages,
        oldTotalPages + 1,
        downloadNewChapters,
        enqueue,
      );
    }
  }

  await resequenceNovelChapters(novelId, pageOrder);
};

/**
 * Update a specific page of chapters for a novel.
 */
const updateNovelPage = async (
  pluginId: string,
  novelName: string,
  novelPath: string,
  novelId: number,
  page: string,
  options: Pick<UpdateNovelOptions, 'downloadNewChapters' | 'enqueue'>,
) => {
  const { downloadNewChapters } = options;
  const sourcePage = await fetchPage(pluginId, novelPath, page);

  await updateNovelChapters(
    pluginId,
    novelName,
    novelId,
    sourcePage.chapters || [],
    downloadNewChapters,
    page,
    options.enqueue,
  );

  await resequenceNovelChapters(novelId, getPluginPageOrder(pluginId));
};

export { updateNovel, updateNovelPage };
