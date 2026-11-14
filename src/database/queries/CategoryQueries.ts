import { eq, sql, inArray, and, ne, count } from 'drizzle-orm';
import { BackupCategory, Category, NovelCategory, CCategory } from '../types';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import { dbManager } from '@database/db';
import {
  categorySchema,
  novelCategorySchema,
  type CategoryRow,
} from '@database/schema';
import { BUILT_IN_CATEGORY_IDS } from '@database/constants';

const DEFAULT_CATEGORY_ID = BUILT_IN_CATEGORY_IDS.default;

const normalizeCategoryName = (categoryName: string): string => {
  const normalizedName = categoryName.trim();
  if (!normalizedName) {
    throw new Error('Category name cannot be empty');
  }
  return normalizedName;
};

/**
 * Get all categories with their novel IDs using Drizzle ORM
 */
export const getCategoriesFromDb = async (): Promise<
  (CategoryRow & { novelIds: string | null })[]
> => {
  return await dbManager
    .select({
      id: categorySchema.id,
      name: categorySchema.name,
      sort: categorySchema.sort,
      novelIds: sql<
        string | null
      >`GROUP_CONCAT(${novelCategorySchema.novelId} ORDER BY ${novelCategorySchema.novelId})`,
    })
    .from(categorySchema)
    .leftJoin(
      novelCategorySchema,
      eq(novelCategorySchema.categoryId, categorySchema.id),
    )
    .groupBy(categorySchema.id, categorySchema.name, categorySchema.sort)
    .orderBy(categorySchema.sort)
    .all();
};

/**
 * Get categories with novel count for the specified novels
 */
export const getCategoriesWithCount = async (
  novelIds: number[],
): Promise<CCategory[]> => {
  if (!novelIds.length) {
    return await dbManager
      .select({
        id: categorySchema.id,
        name: categorySchema.name,
        sort: categorySchema.sort,
        novelsCount: sql<number>`0`,
      })
      .from(categorySchema)
      .where(ne(categorySchema.id, 2))
      .orderBy(categorySchema.sort)
      .all();
  }

  // Use subquery to count novels per category
  const result = await dbManager.transaction(async tx => {
    const subquery = tx
      .select({
        categoryId: novelCategorySchema.categoryId,
        novelsCount: count(novelCategorySchema.novelId).as('novelsCount'),
      })
      .from(novelCategorySchema)
      .where(inArray(novelCategorySchema.novelId, novelIds))
      .groupBy(novelCategorySchema.categoryId)
      .as('NC');

    const r = await tx
      .select({
        id: categorySchema.id,
        name: categorySchema.name,
        sort: categorySchema.sort,
        novelsCount: sql<number>`COALESCE(${subquery.novelsCount}, 0)`,
      })
      .from(categorySchema)
      .leftJoin(subquery, eq(categorySchema.id, subquery.categoryId))
      .where(ne(categorySchema.id, 2))
      .orderBy(categorySchema.sort);

    return r;
  });

  return result;
};

/**
 * Create a new category using Drizzle ORM
 */
export const createCategory = async (
  categoryName: string,
): Promise<CategoryRow> => {
  const normalizedName = normalizeCategoryName(categoryName);

  return await dbManager.write(async tx => {
    const categoryCount = await tx.$count(categorySchema);
    const row = await tx
      .insert(categorySchema)
      .values({ name: normalizedName, sort: categoryCount + 1 })
      .returning()
      .get();
    return row;
  });
};

/**
 * Delete a category by ID with proper handling of novels
 * Before deletion, reassigns novels that only belong to this category to the default category
 */
export const deleteCategoryById = async (category: Category): Promise<void> => {
  if (category.id <= 2) {
    return showToast(getString('categories.cantDeleteDefault'));
  }

  await dbManager.write(async tx => {
    const defaultCategoryId = 1;

    // Find novels that only belong to this category
    const novelsWithOnlyThisCategory = await tx
      .select({ novelId: novelCategorySchema.novelId })
      .from(novelCategorySchema)
      .groupBy(novelCategorySchema.novelId)
      .having(sql`COUNT(${novelCategorySchema.categoryId}) = 1`)
      .all();

    const novelIds = novelsWithOnlyThisCategory.map(row => row.novelId);

    // Update those novels to belong to the default category
    if (novelIds.length > 0) {
      await tx
        .update(novelCategorySchema)
        .set({ categoryId: defaultCategoryId })
        .where(
          and(
            inArray(novelCategorySchema.novelId, novelIds),
            eq(novelCategorySchema.categoryId, category.id),
          ),
        )
        .run();
    }

    // Delete the category
    await tx
      .delete(categorySchema)
      .where(eq(categorySchema.id, category.id))
      .run();
  });
};

/**
 * Update a category name using Drizzle ORM
 */
export const updateCategory = async (
  categoryId: number,
  categoryName: string,
): Promise<void> => {
  if (categoryId === DEFAULT_CATEGORY_ID) {
    return;
  }

  const normalizedName = normalizeCategoryName(categoryName);

  await dbManager.write(async tx => {
    await tx
      .update(categorySchema)
      .set({ name: normalizedName })
      .where(eq(categorySchema.id, categoryId))
      .run();
  });
};

/**
 * Check if a category name already exists using Drizzle ORM
 */
export const isCategoryNameDuplicate = (categoryName: string): boolean => {
  const normalizedName = categoryName.trim();
  if (!normalizedName) {
    return false;
  }

  const result = dbManager.getSync(
    dbManager
      .select({ id: categorySchema.id })
      .from(categorySchema)
      .where(eq(categorySchema.name, normalizedName)),
  );

  return !!result;
};

/**
 * Update the sort order of categories
 */
export const updateCategoryOrderInDb = async (
  categories: Category[],
): Promise<void> => {
  if (!categories.length) {
    return;
  }

  await dbManager.write(async tx => {
    for (const [index, category] of categories.entries()) {
      await tx
        .update(categorySchema)
        .set({ sort: index + 1 })
        .where(eq(categorySchema.id, category.id))
        .run();
    }
  });
};

/**
 * Get all novel-category associations
 */
export const getAllNovelCategories = async (): Promise<NovelCategory[]> => {
  return await dbManager.select().from(novelCategorySchema).all();
};

/**
 * Restore a category from backup
 * Used during the restore process
 */
export const _restoreCategory = async (
  category: BackupCategory,
  novelIdMap?: ReadonlyMap<number, number>,
): Promise<number> => {
  return dbManager.write(async tx => {
    const isDefaultCategory = category.id === DEFAULT_CATEGORY_ID;
    const normalizedName = isDefaultCategory
      ? undefined
      : normalizeCategoryName(category.name);
    const existingByName = normalizedName
      ? await tx
          .select({ id: categorySchema.id })
          .from(categorySchema)
          .where(eq(categorySchema.name, normalizedName))
          .get()
      : undefined;
    const existingDefault =
      existingByName || !isDefaultCategory
        ? undefined
        : await tx
            .select({ id: categorySchema.id })
            .from(categorySchema)
            .where(eq(categorySchema.id, DEFAULT_CATEGORY_ID))
            .get();

    let categoryId = existingByName?.id ?? existingDefault?.id;
    if (!categoryId) {
      const restoredCategory = await tx
        .insert(categorySchema)
        .values({
          name: normalizedName ?? getString('categories.default'),
          sort: category.sort,
        })
        .returning({ id: categorySchema.id })
        .get();
      categoryId = restoredCategory.id;
    }

    if (category.novelIds && category.novelIds.length > 0) {
      const membershipBatchSize = 500;
      for (
        let batchStart = 0;
        batchStart < category.novelIds.length;
        batchStart += membershipBatchSize
      ) {
        const memberships = category.novelIds
          .slice(batchStart, batchStart + membershipBatchSize)
          .map(backupNovelId => ({
            categoryId,
            novelId: novelIdMap?.get(backupNovelId) ?? backupNovelId,
          }));

        await tx
          .insert(novelCategorySchema)
          .values(memberships)
          .onConflictDoNothing()
          .run();
      }
    }

    return categoryId;
  });
};
