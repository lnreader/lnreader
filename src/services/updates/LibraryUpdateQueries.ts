import { fetchNovel, fetchPage } from '../plugin/fetch';
import { ChapterItem, SourceNovel } from '@plugins/types';
import { getPlugin, LOCAL_PLUGIN_ID } from '@plugins/pluginManager';
import { NOVEL_STORAGE } from '@utils/Storages';
import { downloadFile } from '@plugins/helpers/fetch';
import ServiceManager from '@services/ServiceManager';
import { dbManager } from '@database/db';
import { novelSchema, chapterSchema } from '@database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import NativeFile from '@specs/NativeFile';
import { insertChapters } from '@database/queries/ChapterQueries';

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

  if (!NativeFile.exists(novelDir)) {
    NativeFile.mkdir(novelDir);
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
  novelName: string,
  novelId: number,
  chapters: ChapterItem[],
  downloadNewChapters?: boolean,
  page?: string,
) => {
  if (!chapters.length) {
    return;
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
  });

  if (downloadNewChapters && newPaths.length) {
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

    for (const insertedChapter of insertedNewChapters) {
      ServiceManager.manager.addTask({
        name: 'DOWNLOAD_CHAPTER',
        data: {
          chapterId: insertedChapter.id,
          novelName,
          chapterName:
            chapterNameByPath.get(insertedChapter.path) || insertedChapter.name,
        },
      });
    }
  }
};

export interface UpdateNovelOptions {
  downloadNewChapters?: boolean;
  refreshNovelMetadata?: boolean;
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
  const { downloadNewChapters, refreshNovelMetadata } = options;

  const oldTotalPages = await getStoredTotalPages(novelId);

  const novel = await fetchNovel(pluginId, novelPath);

  if (refreshNovelMetadata) {
    await updateNovelMetadata(pluginId, novelId, novel);
  } else if (novel.totalPages) {
    await updateNovelTotalPages(novelId, novel.totalPages);
  }
  await updateNovelChapters(
    novel.name,
    novelId,
    novel.chapters || [],
    downloadNewChapters,
  );

  // For paged novels: re-fetch the last known page and fetch any new pages
  if (novel.totalPages && novel.totalPages > 1) {
    const plugin = getPlugin(pluginId);
    if (plugin?.parsePage) {
      // Re-fetch the last known page to check for new chapters
      if (oldTotalPages > 1) {
        try {
          const sourcePage = await fetchPage(
            pluginId,
            novelPath,
            String(oldTotalPages),
          );
          await updateNovelChapters(
            novel.name,
            novelId,
            sourcePage.chapters || [],
            downloadNewChapters,
            String(oldTotalPages),
          );
        } catch {}
      }

      // Fetch any new pages that were added
      for (let page = oldTotalPages + 1; page <= novel.totalPages; page++) {
        try {
          const sourcePage = await fetchPage(pluginId, novelPath, String(page));
          await updateNovelChapters(
            novel.name,
            novelId,
            sourcePage.chapters || [],
            downloadNewChapters,
            String(page),
          );
        } catch {}
      }
    }
  }
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
  options: Pick<UpdateNovelOptions, 'downloadNewChapters'>,
) => {
  const { downloadNewChapters } = options;
  const sourcePage = await fetchPage(pluginId, novelPath, page);

  await updateNovelChapters(
    novelName,
    novelId,
    sourcePage.chapters || [],
    downloadNewChapters,
    page,
  );
};

export { updateNovel, updateNovelPage };
