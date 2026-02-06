import { fetchNovel, fetchPage } from '../plugin/fetch';
import { ChapterItem, SourceNovel } from '@plugins/types';
import { getPlugin, LOCAL_PLUGIN_ID } from '@plugins/pluginManager';
import { NOVEL_STORAGE } from '@utils/Storages';
import { downloadFile } from '@plugins/helpers/fetch';
import ServiceManager from '@services/ServiceManager';
import { dbManager } from '@database/db';
import { novelSchema, chapterSchema } from '@database/schema';
import { eq, and, ne, or, sql } from 'drizzle-orm';
import NativeFile from '@specs/NativeFile';

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
    tx.update(novelSchema)
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
    tx.update(novelSchema)
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
  await dbManager.write(async tx => {
    for (let position = 0; position < chapters.length; position++) {
      const chapter = chapters[position];
      const {
        name,
        path,
        releaseTime,
        page: customPage,
        chapterNumber,
      } = chapter;
      const chapterPage = page || customPage || '1';

      // Check if chapter already exists
      const existing = await tx
        .select({ id: chapterSchema.id })
        .from(chapterSchema)
        .where(
          and(eq(chapterSchema.novelId, novelId), eq(chapterSchema.path, path)),
        )
        .get();

      if (!existing) {
        // Insert new chapter
        const newChapter = await tx
          .insert(chapterSchema)
          .values({
            path,
            name,
            releaseTime: releaseTime || null,
            novelId,
            updatedTime: sql`datetime('now','localtime')`,
            chapterNumber: chapterNumber || null,
            page: chapterPage,
            position: position,
          })
          .returning()
          .get();

        if (newChapter && downloadNewChapters) {
          ServiceManager.manager.addTask({
            name: 'DOWNLOAD_CHAPTER',
            data: {
              chapterId: newChapter.id,
              novelName: novelName,
              chapterName: name,
            },
          });
        }
      } else {
        // Update existing chapter if metadata changed
        tx.update(chapterSchema)
          .set({
            name,
            releaseTime: releaseTime || null,
            updatedTime: sql`datetime('now','localtime')`,
            page: chapterPage,
            position: position,
          })
          .where(
            and(
              eq(chapterSchema.id, existing.id),
              eq(chapterSchema.novelId, novelId),
              or(
                ne(chapterSchema.name, name),
                ne(chapterSchema.releaseTime, releaseTime!),
                ne(chapterSchema.page, chapterPage),
                ne(chapterSchema.position, position),
              ),
            ),
          )
          .run();
      }
    }
  });
};

export interface UpdateNovelOptions {
  downloadNewChapters?: boolean;
  refreshNovelMetadata?: boolean;
}

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
