import * as DocumentPicker from 'expo-document-picker';
import { eq, and, sql, inArray, ne, getColumns } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Scalar, Transaction } from '@op-engineering/op-sqlite';

import { fetchNovel } from '@services/plugin/fetch';
import { insertChapters } from './ChapterQueries';

import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import {
  BackupNovel,
  DBNovelInfo,
  NovelInfo,
  type RestoredNovelMapping,
} from '../types';
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
import type { TransactionParameter } from '@database/manager/manager.d';
import { getLibraryDefaultCategoryId } from '@hooks/persisted/useSettings';
import NativeFile from '@modules/native-file';
import { BUILT_IN_CATEGORY_IDS } from '@database/constants';
import { createNovelTriggerQueryDelete } from '@database/queryStrings/triggers';

const getBuiltInDefaultCategory = async (tx: TransactionParameter) => {
  const defaultCategory = await tx
    .select({ id: categorySchema.id })
    .from(categorySchema)
    .where(eq(categorySchema.id, BUILT_IN_CATEGORY_IDS.default))
    .get();

  return defaultCategory ? [defaultCategory] : [];
};

const getCategoriesForNewNovel = async (
  tx: TransactionParameter,
  categoryIds?: number[],
) => {
  if (categoryIds !== undefined) {
    if (categoryIds.length) {
      const selectedCategories = await tx
        .select({ id: categorySchema.id })
        .from(categorySchema)
        .where(inArray(categorySchema.id, categoryIds))
        .all();

      if (selectedCategories.length) {
        return selectedCategories;
      }
    }

    return getBuiltInDefaultCategory(tx);
  }

  const preferredCategoryId = getLibraryDefaultCategoryId();

  if (preferredCategoryId) {
    const preferredCategory = await tx
      .select({ id: categorySchema.id })
      .from(categorySchema)
      .where(eq(categorySchema.id, preferredCategoryId))
      .get();

    if (preferredCategory) {
      return [preferredCategory];
    }
  }

  return getBuiltInDefaultCategory(tx);
};

const getCategoryForNewNovel = async (tx: TransactionParameter) =>
  (await getCategoriesForNewNovel(tx))[0];

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
      await NativeFile.mkdir(novelDir);
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

export const getNovelById = (novelId: number): DBNovelInfo | undefined => {
  return dbManager.getSync(
    dbManager.select().from(novelSchema).where(eq(novelSchema.id, novelId)),
  );
};

export const getNovelByPath = (
  novelPath: string,
  pluginId: string,
): DBNovelInfo | undefined => {
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
  categoryIds?: number[],
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
        // Add to library with the selected or configured default categories.
        const categories = await getCategoriesForNewNovel(tx, categoryIds);

        if (categories.length) {
          await tx
            .insert(novelCategorySchema)
            .values(
              categories.map((category: { id: number }) => ({
                novelId: novel.id,
                categoryId: category.id,
              })),
            )
            .run();
        }

        if (novel.pluginId === 'local') {
          await tx
            .insert(novelCategorySchema)
            .values({
              novelId: novel.id,
              categoryId: BUILT_IN_CATEGORY_IDS.local,
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

        const categories = await getCategoriesForNewNovel(tx, categoryIds);

        if (categories.length) {
          await tx
            .insert(novelCategorySchema)
            .values(
              categories.map((category: { id: number }) => ({
                novelId: novelId,
                categoryId: category.id,
              })),
            )
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
export const removeNovelsFromLibrary = async (novelIds: number[]) => {
  if (!novelIds.length) return;

  await dbManager.write(async tx => {
    await tx
      .update(novelSchema)
      .set({ inLibrary: false })
      .where(inArray(novelSchema.id, novelIds))
      .run();

    await tx
      .delete(novelCategorySchema)
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
    await tx.delete(novelSchema).where(eq(novelSchema.inLibrary, false)).run();
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
      const defaultCategory = await getCategoryForNewNovel(tx);

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
    await tx
      .update(novelSchema)
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
    if (!(await NativeFile.exists(novelDir))) {
      await NativeFile.mkdir(novelDir);
    }
    await NativeFile.copyFile(image.assets[0].uri, novelCoverUri);
    novelCoverUri += '?' + Date.now();
    await dbManager.write(async tx => {
      await tx
        .update(novelSchema)
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
      await tx
        .insert(novelCategorySchema)
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
    await tx
      .update(novelSchema)
      .set({ inLibrary: true })
      .where(inArray(novelSchema.id, novelIds))
      .run();

    // Delete existing categories (keeping local category if present)
    await tx
      .delete(novelCategorySchema)
      .where(
        and(
          inArray(novelCategorySchema.novelId, novelIds),
          ne(novelCategorySchema.categoryId, BUILT_IN_CATEGORY_IDS.local),
        ),
      )
      .run();

    if (categoryIds.length) {
      for (const novelId of novelIds) {
        for (const categoryId of categoryIds) {
          await tx
            .insert(novelCategorySchema)
            .values({ novelId, categoryId })
            .onConflictDoNothing()
            .run();
        }
      }
    } else {
      // If no category is selected, use the preferred category and fall back
      // to the app's built-in default.
      const defaultCategory = await getCategoryForNewNovel(tx);

      if (defaultCategory) {
        for (const novelId of novelIds) {
          // Check if it already has some category (e.g. local)
          const hasCategory = await tx
            .select({ count: sql<number>`count(*)` })
            .from(novelCategorySchema)
            .where(eq(novelCategorySchema.novelId, novelId))
            .get();

          if (!hasCategory || hasCategory.count === 0) {
            await tx
              .insert(novelCategorySchema)
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

type RestoreColumns = { keys: string[]; columns: SQLiteColumn[] };

const getRestoreColumns = (table: SQLiteTable): RestoreColumns => {
  const entries = Object.entries(getColumns(table)).filter(
    ([key]) => key !== 'id',
  );
  return {
    keys: entries.map(([key]) => key),
    columns: entries.map(([, column]) => column),
  };
};

const novelRestoreColumns = getRestoreColumns(novelSchema);
const chapterRestoreColumns = getRestoreColumns(chapterSchema);
const chapterNovelIdIndex = chapterRestoreColumns.keys.indexOf('novelId');

const quoteColumns = ({ columns }: RestoreColumns) =>
  columns.map(column => `"${column.name}"`).join(', ');

const rowPlaceholders = (columnCount: number) =>
  `(${new Array(columnCount).fill('?').join(', ')})`;

// Encodes a backup value the way Drizzle's insert builder does: a missing
// value falls back to the column default (else NULL) and booleans become 0/1.
const toDriverValue = (column: SQLiteColumn, value: unknown): Scalar => {
  const resolved = value === undefined ? column.default ?? null : value;
  return resolved === null
    ? null
    : (column.mapToDriverValue(resolved) as Scalar);
};

const NOVEL_UPSERT_PREFIX = `INSERT INTO Novel (${quoteColumns(
  novelRestoreColumns,
)}) VALUES ${rowPlaceholders(
  novelRestoreColumns.keys.length,
)} ON CONFLICT ("path", "pluginId") DO UPDATE SET `;

const CHAPTER_INSERT_BATCH_SIZE = 100;
const chapterInsertPrefix = `INSERT INTO Chapter (${quoteColumns(
  chapterRestoreColumns,
)}) VALUES `;
const chapterInsertSql = (rowCount: number) =>
  chapterInsertPrefix +
  new Array(rowCount)
    .fill(rowPlaceholders(chapterRestoreColumns.keys.length))
    .join(', ');
const fullChapterBatchSql = chapterInsertSql(CHAPTER_INSERT_BATCH_SIZE);

const restoreNovelAndChapters = async (
  tx: Transaction,
  backupNovel: BackupNovel,
): Promise<RestoredNovelMapping> => {
  const { chapters, id: backupNovelId, ...novel } = backupNovel;
  const novelValues: Record<string, unknown> = {
    ...novel,
    totalChapters: 0,
    chaptersDownloaded: 0,
    chaptersUnread: 0,
  };

  // Match novels by their stable source identity, not the database-local ID.
  // Like Drizzle's onConflictDoUpdate, only keys present in the backup are
  // overwritten on conflict.
  const updatedColumns = novelRestoreColumns.columns
    .filter((_, i) => novelValues[novelRestoreColumns.keys[i]] !== undefined)
    .map(column => `"${column.name}" = excluded."${column.name}"`)
    .join(', ');
  await tx.execute(
    NOVEL_UPSERT_PREFIX + updatedColumns,
    novelRestoreColumns.columns.map((column, i) =>
      toDriverValue(column, novelValues[novelRestoreColumns.keys[i]]),
    ),
  );
  const restoredNovel = (
    await tx.execute('SELECT id FROM Novel WHERE path = ? AND pluginId = ?', [
      toDriverValue(novelSchema.path, novel.path),
      toDriverValue(novelSchema.pluginId, novel.pluginId),
    ])
  ).rows[0] as { id: number };

  if (novel.cover?.startsWith(`file://${NOVEL_STORAGE}/`)) {
    const cacheSuffix = novel.cover.match(/[?#].*$/)?.[0] ?? '';
    await tx.execute('UPDATE Novel SET cover = ? WHERE id = ?', [
      `file://${NOVEL_STORAGE}/${novel.pluginId}/${restoredNovel.id}/cover.png${cacheSuffix}`,
      restoredNovel.id,
    ]);
  }

  const { rowsAffected } = await tx.execute(
    'DELETE FROM Chapter WHERE novelId = ?',
    [restoredNovel.id],
  );
  if (rowsAffected > 0) {
    // The chapter delete trigger is suspended during restore; this is the
    // state it leaves behind once a novel has no chapters.
    await tx.execute(
      'UPDATE Novel SET chaptersDownloaded = 0, chaptersUnread = 0, totalChapters = 0, lastReadAt = NULL, lastUpdatedAt = NULL WHERE id = ?',
      [restoredNovel.id],
    );
  }

  const { keys, columns } = chapterRestoreColumns;
  for (let i = 0; i < chapters.length; i += CHAPTER_INSERT_BATCH_SIZE) {
    const batch = chapters.slice(i, i + CHAPTER_INSERT_BATCH_SIZE);
    const params: Scalar[] = [];
    for (const chapter of batch) {
      const values = chapter as unknown as Record<string, unknown>;
      for (let c = 0; c < keys.length; c++) {
        params.push(
          c === chapterNovelIdIndex
            ? restoredNovel.id
            : toDriverValue(columns[c], values[keys[c]]),
        );
      }
    }
    await tx.execute(
      batch.length === CHAPTER_INSERT_BATCH_SIZE
        ? fullChapterBatchSql
        : chapterInsertSql(batch.length),
      params,
    );
  }

  const chapterMappings: RestoredNovelMapping['chapters'] = [];
  if (chapters.length > 0) {
    const restoredChapters = (
      await tx.execute('SELECT id, path FROM Chapter WHERE novelId = ?', [
        restoredNovel.id,
      ])
    ).rows as { id: number; path: string }[];
    const restoredIdsByPath = new Map(
      restoredChapters.map(chapter => [chapter.path, chapter.id]),
    );
    for (const chapter of chapters) {
      const restoredChapterId = restoredIdsByPath.get(chapter.path);
      if (restoredChapterId !== undefined) {
        chapterMappings.push({
          backupChapterId: chapter.id,
          restoredChapterId,
        });
      }
    }
  }

  return {
    pluginId: novel.pluginId,
    backupNovelId,
    restoredNovelId: restoredNovel.id,
    chapters: chapterMappings,
  };
};

export type RestoreNovelResult =
  | { mapping: RestoredNovelMapping; error?: undefined }
  | { mapping?: undefined; error: unknown };

/**
 * Restores novels and their chapters from backup objects in one transaction.
 * Each novel is isolated in a savepoint, so a failing novel is rolled back
 * without affecting the others. Results are returned in input order.
 */
export const _restoreNovelsAndChapters = async (
  backupNovels: BackupNovel[],
): Promise<RestoreNovelResult[]> => {
  if (!backupNovels.length) return [];

  return dbManager.writeRaw(async tx => {
    // The delete trigger recounts a novel's chapters once per deleted row,
    // which is quadratic when a restore replaces a large chapter list.
    await tx.execute('DROP TRIGGER IF EXISTS update_novel_stats_on_delete');
    const results: RestoreNovelResult[] = [];
    for (const backupNovel of backupNovels) {
      await tx.execute('SAVEPOINT restore_novel');
      try {
        const mapping = await restoreNovelAndChapters(tx, backupNovel);
        await tx.execute('RELEASE restore_novel');
        results.push({ mapping });
      } catch (error) {
        await tx.execute('ROLLBACK TO restore_novel');
        await tx.execute('RELEASE restore_novel');
        results.push({ error });
      }
    }
    await tx.execute(createNovelTriggerQueryDelete);
    return results;
  });
};
