import * as DocumentPicker from 'expo-document-picker';
import { eq, and, sql, inArray, ne } from 'drizzle-orm';

import { fetchNovel } from '@services/plugin/fetch';
import { insertChapters } from './ChapterQueries';

import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import { DBNovelInfo, NovelInfo } from '../types';
import { SourceNovel } from '@plugins/types';
import { NOVEL_STORAGE } from '@utils/Storages';
import { downloadFile } from '@plugins/helpers/fetch';
import { getPlugin } from '@plugins/pluginManager';
import { dbManager } from '@database/db';
import {
  novelSchema,
  novelCategorySchema,
  categorySchema,
} from '@database/schema';
import type { TransactionParameter } from '@database/manager/manager.d';
import { getLibraryDefaultCategoryId } from '@hooks/persisted/useSettings';
import NativeFile from '@modules/native-file';
import { BUILT_IN_CATEGORY_IDS } from '@database/constants';

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

export const getCategoryForNewNovel = async (tx: TransactionParameter) =>
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
