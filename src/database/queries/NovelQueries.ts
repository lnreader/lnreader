import * as DocumentPicker from 'expo-document-picker';
import { eq, and, sql, inArray, ne } from 'drizzle-orm';

import { fetchNovel } from '@services/plugin/fetch';
import { insertChapters } from './ChapterQueries';

import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { BackupNovel, NovelInfo } from '../types';
import { SourceNovel } from '@plugins/types';
import { NOVEL_STORAGE } from '@utils/Storages';
import { downloadFile } from '@plugins/helpers/fetch';
import { getPlugin } from '@plugins/pluginManager';
import { dbManager } from '@database/db';
import {
  novelSchema,
  novelCategorySchema,
  categorySchema,
  chapterSchema,
} from '@database/schema';
import NativeFile from '@specs/NativeFile';
import {
  RestoreOptions,
  andUnread,
  maxDateString,
  maxNum,
  orBool,
  preferExisting,
} from './_restoreMergeUtils';

/**
 * Inserts a novel and its chapters into the database using Drizzle ORM.
 * Also handles downloading the novel cover if available.
 */
export const insertNovelAndChapters = async (
  pluginId: string,
  sourceNovel: SourceNovel,
): Promise<number | undefined> => {
  const result = await dbManager.write(async tx => {
    return tx
      .insert(novelSchema)
      .values({
        path: sourceNovel.path,
        pluginId,
        name: sourceNovel.name,
        cover: sourceNovel.cover || null,
        summary: sourceNovel.summary || null,
        author: sourceNovel.author || null,
        artist: sourceNovel.artist || null,
        status: sourceNovel.status || null,
        genres: sourceNovel.genres || null,
        totalPages: sourceNovel.totalPages || 0,
      })
      .onConflictDoNothing()
      .returning()
      .all();
  });

  const novelId = result?.[0]?.id;

  if (novelId) {
    if (sourceNovel.cover) {
      const novelDir = NOVEL_STORAGE + '/' + pluginId + '/' + novelId;
      NativeFile.mkdir(novelDir);
      const novelCoverPath = novelDir + '/cover.png';
      const novelCoverUri = 'file://' + novelCoverPath;

      try {
        await downloadFile(
          sourceNovel.cover,
          novelCoverPath,
          getPlugin(pluginId)?.imageRequestInit,
        );
        await dbManager.write(async tx => {
          tx.update(novelSchema)
            .set({ cover: novelCoverUri })
            .where(eq(novelSchema.id, novelId))
            .run();
        });
      } catch {
        // Silently fail cover download
      }
    }
    await insertChapters(novelId, sourceNovel.chapters);
  }
  return novelId;
};

export const getAllNovels = async (): Promise<NovelInfo[]> => {
  return dbManager.select().from(novelSchema).all();
};

export const getNovelById = async (
  novelId: number,
): Promise<NovelInfo | undefined> => {
  const res = dbManager
    .select()
    .from(novelSchema)
    .where(eq(novelSchema.id, novelId))
    .get();
  return res;
};

export const getNovelByPath = (
  novelPath: string,
  pluginId: string,
): NovelInfo | undefined => {
  const res = dbManager.getSync(
    dbManager
      .select()
      .from(novelSchema)
      .where(
        and(
          eq(novelSchema.path, novelPath),
          eq(novelSchema.pluginId, pluginId),
        ),
      ),
  );
  return res;
};

/**
 * Toggles a novel's presence in the library.
 * Manages category associations and novel info retrieval if it doesn't exist.
 */
export const switchNovelToLibraryQuery = async (
  novelPath: string,
  pluginId: string,
): Promise<NovelInfo | undefined> => {
  const novel = await getNovelByPath(novelPath, pluginId);
  if (novel) {
    const newInLibrary = !novel.inLibrary;
    await dbManager.write(async tx => {
      await tx
        .update(novelSchema)
        .set({ inLibrary: newInLibrary })
        .where(eq(novelSchema.id, novel.id))
        .run();

      if (!newInLibrary) {
        // Remove from library: delete categories
        await tx
          .delete(novelCategorySchema)
          .where(eq(novelCategorySchema.novelId, novel.id))
          .run();
        showToast(getString('browseScreen.removeFromLibrary'));
      } else {
        // Add to library: add to default category
        const defaultCategory = await tx
          .select({ id: categorySchema.id })
          .from(categorySchema)
          .where(eq(categorySchema.sort, 1))
          .get();

        if (defaultCategory) {
          await tx
            .insert(novelCategorySchema)
            .values({
              novelId: novel.id,
              categoryId: defaultCategory.id,
            })
            .run();
        }

        if (novel.pluginId === 'local') {
          await tx
            .insert(novelCategorySchema)
            .values({
              novelId: novel.id,
              categoryId: 2,
            })
            .onConflictDoNothing()
            .run();
        }
        showToast(getString('browseScreen.addedToLibrary'));
      }
    });
    return { ...novel, inLibrary: newInLibrary };
  } else {
    const sourceNovel = await fetchNovel(pluginId, novelPath);
    const novelId = await insertNovelAndChapters(pluginId, sourceNovel);
    if (novelId) {
      await dbManager.write(async tx => {
        await tx
          .update(novelSchema)
          .set({ inLibrary: true })
          .where(eq(novelSchema.id, novelId))
          .run();

        const defaultCategory = await tx
          .select({ id: categorySchema.id })
          .from(categorySchema)
          .where(eq(categorySchema.sort, 1))
          .get();

        if (defaultCategory) {
          await tx
            .insert(novelCategorySchema)
            .values({
              novelId: novelId,
              categoryId: defaultCategory.id,
            })
            .run();
        }
      });
      showToast(getString('browseScreen.addedToLibrary'));
      return getNovelById(novelId);
    }
  }
};

/**
 * Removes multiple novels from the library and clears their categories.
 */
export const removeNovelsFromLibrary = async (novelIds: Array<number>) => {
  if (!novelIds.length) return;

  await dbManager.write(async tx => {
    tx.update(novelSchema)
      .set({ inLibrary: false })
      .where(inArray(novelSchema.id, novelIds))
      .run();

    tx.delete(novelCategorySchema)
      .where(inArray(novelCategorySchema.novelId, novelIds))
      .run();
  });
  showToast(getString('browseScreen.removeFromLibrary'));
};

export const getCachedNovels = async (): Promise<NovelInfo[]> => {
  return dbManager
    .select()
    .from(novelSchema)
    .where(eq(novelSchema.inLibrary, false))
    .all();
};

export const deleteCachedNovels = async () => {
  await dbManager.write(async tx => {
    tx.delete(novelSchema).where(eq(novelSchema.inLibrary, false)).run();
  });
  showToast(getString('advancedSettingsScreen.cachedNovelsDeletedToast'));
};

/**
 * Restore a novel from backup using Drizzle ORM.
 */
export const restoreLibrary = async (novel: NovelInfo) => {
  const sourceNovel = await fetchNovel(novel.pluginId, novel.path).catch(e => {
    throw e;
  });

  const novelId = await dbManager.write(async tx => {
    const row = await tx
      .insert(novelSchema)
      .values({
        path: sourceNovel.path,
        name: novel.name,
        pluginId: novel.pluginId,
        cover: novel.cover || '',
        summary: novel.summary || '',
        author: novel.author || '',
        artist: novel.artist || '',
        status: novel.status || '',
        genres: novel.genres || '',
        totalPages: sourceNovel.totalPages || 0,
        inLibrary: true,
      })
      .onConflictDoUpdate({
        target: [novelSchema.path, novelSchema.pluginId],
        set: {
          name: novel.name,
          cover: novel.cover || '',
          summary: novel.summary || '',
          author: novel.author || '',
          artist: novel.artist || '',
          status: novel.status || '',
          genres: novel.genres || '',
          totalPages: sourceNovel.totalPages || 0,
          inLibrary: true,
        },
      })
      .returning()
      .get();

    if (row) {
      const defaultCategory = await tx
        .select({ id: categorySchema.id })
        .from(categorySchema)
        .where(eq(categorySchema.sort, 1))
        .get();

      if (defaultCategory) {
        await tx
          .insert(novelCategorySchema)
          .values({
            novelId: row.id,
            categoryId: defaultCategory.id,
          })
          .onConflictDoNothing()
          .run();
      }
    }
    return row?.id;
  });

  if (novelId && sourceNovel.chapters) {
    await insertChapters(novelId, sourceNovel.chapters);
  }
};

export const updateNovelInfo = async (info: NovelInfo) => {
  await dbManager.write(async tx => {
    tx.update(novelSchema)
      .set({
        name: info.name,
        cover: info.cover || '',
        path: info.path,
        summary: info.summary || '',
        author: info.author || '',
        artist: info.artist || '',
        genres: info.genres || '',
        status: info.status || '',
        isLocal: info.isLocal,
      })
      .where(eq(novelSchema.id, info.id))
      .run();
  });
};

/**
 * Handles picking and saving a custom novel cover.
 */
export const pickCustomNovelCover = async (novel: NovelInfo) => {
  const image = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
  if (image.assets && image.assets[0]) {
    const novelDir = NOVEL_STORAGE + '/' + novel.pluginId + '/' + novel.id;
    let novelCoverUri = 'file://' + novelDir + '/cover.png';
    if (!NativeFile.exists(novelDir)) {
      NativeFile.mkdir(novelDir);
    }
    NativeFile.copyFile(image.assets[0].uri, novelCoverUri);
    novelCoverUri += '?' + Date.now();
    await dbManager.write(async tx => {
      tx.update(novelSchema)
        .set({ cover: novelCoverUri })
        .where(eq(novelSchema.id, novel.id))
        .run();
    });
    return novelCoverUri;
  }
};

export const updateNovelCategoryById = async (
  novelId: number,
  categoryIds: number[],
) => {
  await dbManager.write(async tx => {
    for (const categoryId of categoryIds) {
      tx.insert(novelCategorySchema)
        .values({ novelId, categoryId })
        .onConflictDoNothing()
        .run();
    }
  });
};

/**
 * Updates categories for multiple novels.
 */
export const updateNovelCategories = async (
  novelIds: number[],
  categoryIds: number[],
): Promise<void> => {
  if (!novelIds.length) return;

  await dbManager.write(async tx => {
    // Delete existing categories (keeping local category if present)
    await tx
      .delete(novelCategorySchema)
      .where(
        and(
          inArray(novelCategorySchema.novelId, novelIds),
          ne(novelCategorySchema.categoryId, 2),
        ),
      )
      .run();

    if (categoryIds.length) {
      for (const novelId of novelIds) {
        for (const categoryId of categoryIds) {
          tx.insert(novelCategorySchema)
            .values({ novelId, categoryId })
            .onConflictDoNothing()
            .run();
        }
      }
    } else {
      // If no category is selected, set to the default category (sort = 1)
      const defaultCategory = await tx
        .select({ id: categorySchema.id })
        .from(categorySchema)
        .where(eq(categorySchema.sort, 1))
        .get();

      if (defaultCategory) {
        for (const novelId of novelIds) {
          // Check if it already has some category (e.g. local)
          const hasCategory = await tx
            .select({ count: sql<number>`count(*)` })
            .from(novelCategorySchema)
            .where(eq(novelCategorySchema.novelId, novelId))
            .get();

          if (!hasCategory || hasCategory.count === 0) {
            tx.insert(novelCategorySchema)
              .values({
                novelId: novelId,
                categoryId: defaultCategory.id,
              })
              .run();
          }
        }
      }
    }
  });
};

/**
 * Restores a novel and its chapters from a backup object.
 *
 * - `overwrite` (default): legacy behaviour — delete the row whose id
 *   matches the backup, then re-insert verbatim.
 * - `merge`: match the existing row by the natural key (path, pluginId)
 *   and merge instead of replacing. Reading progress (bookmark / unread /
 *   readTime / progress / position) is unioned across both sides; novel
 *   stats (totalChapters, chaptersDownloaded, chaptersUnread, lastReadAt,
 *   lastUpdatedAt) are recomputed by SQLite triggers when chapters change.
 */
export const _restoreNovelAndChapters = async (
  backupNovel: BackupNovel,
  options: RestoreOptions = {},
) => {
  const mode = options.mode ?? 'overwrite';
  const { chapters, ...novel } = backupNovel;
  const backupNovelId = novel.id;

  await dbManager.write(async tx => {
    if (mode === 'overwrite') {
      tx.delete(novelSchema).where(eq(novelSchema.id, backupNovelId)).run();
      tx.delete(chapterSchema)
        .where(eq(chapterSchema.novelId, backupNovelId))
        .run();
      tx.insert(novelSchema).values(novel).run();
      if (chapters.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < chapters.length; i += BATCH_SIZE) {
          const batch = chapters.slice(i, i + BATCH_SIZE);
          tx.insert(chapterSchema).values(batch).run();
        }
      }
      options.novelIdMap?.set(backupNovelId, backupNovelId);
      return;
    }

    // merge mode: match on (path, pluginId)
    const existing = await tx
      .select()
      .from(novelSchema)
      .where(
        and(
          eq(novelSchema.path, novel.path),
          eq(novelSchema.pluginId, novel.pluginId),
        ),
      )
      .get();

    let realNovelId: number;

    if (!existing) {
      // new novel — drop the backup id, let auto-increment assign one
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _ignoredId, ...novelInsert } = novel;
      const inserted = await tx
        .insert(novelSchema)
        .values(novelInsert)
        .returning({ id: novelSchema.id })
        .get();
      realNovelId = inserted.id;
    } else {
      realNovelId = existing.id;
      await tx
        .update(novelSchema)
        .set({
          // name: backup wins per merge policy
          name: novel.name,
          cover: preferExisting(existing.cover, novel.cover),
          summary: preferExisting(existing.summary, novel.summary),
          author: preferExisting(existing.author, novel.author),
          artist: preferExisting(existing.artist, novel.artist),
          status: preferExisting(existing.status, novel.status),
          genres: preferExisting(existing.genres, novel.genres),
          inLibrary: orBool(existing.inLibrary, novel.inLibrary),
          isLocal: orBool(existing.isLocal, novel.isLocal),
          totalPages: maxNum(existing.totalPages, novel.totalPages),
          // totalChapters / chaptersDownloaded / chaptersUnread /
          // lastReadAt / lastUpdatedAt are recomputed by triggers when
          // chapter rows change below.
        })
        .where(eq(novelSchema.id, realNovelId))
        .run();
    }

    // Chapters: match on (novelId=realNovelId, path)
    const existingChapters = await tx
      .select()
      .from(chapterSchema)
      .where(eq(chapterSchema.novelId, realNovelId))
      .all();
    const existingByPath = new Map(existingChapters.map(c => [c.path, c]));

    const inserts: Array<typeof chapterSchema.$inferInsert> = [];
    for (const ch of chapters) {
      const existingCh = existingByPath.get(ch.path);
      if (!existingCh) {
        // new chapter — drop backup id, remap novelId to the live one
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, novelId: _nid, ...chapterInsert } = ch;
        inserts.push({ ...chapterInsert, novelId: realNovelId });
      } else {
        await tx
          .update(chapterSchema)
          .set({
            // name: existing wins per merge policy ("사용자 의도")
            name: preferExisting(existingCh.name, ch.name) ?? ch.name,
            releaseTime: preferExisting(existingCh.releaseTime, ch.releaseTime),
            updatedTime: maxDateString(existingCh.updatedTime, ch.updatedTime),
            chapterNumber: preferExisting(
              existingCh.chapterNumber,
              ch.chapterNumber,
            ),
            bookmark: orBool(existingCh.bookmark, ch.bookmark),
            unread: andUnread(existingCh.unread, ch.unread),
            readTime: maxDateString(existingCh.readTime, ch.readTime),
            isDownloaded: orBool(existingCh.isDownloaded, ch.isDownloaded),
            progress: maxNum(existingCh.progress, ch.progress),
            position: maxNum(existingCh.position, ch.position) ?? 0,
            page: existingCh.page ?? ch.page ?? '1',
          })
          .where(eq(chapterSchema.id, existingCh.id))
          .run();
      }
    }

    if (inserts.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        await tx.insert(chapterSchema).values(batch).run();
      }
    }

    options.novelIdMap?.set(backupNovelId, realNovelId);
  });
};
