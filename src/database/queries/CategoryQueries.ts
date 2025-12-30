import { eq, sql, inArray, and, ne, count } from 'drizzle-orm';
import { BackupCategory, Category, NovelCategory, CCategory } from '../types';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { dbManager } from '@database/db';
import {
  categorySchema,
  novelCategorySchema,
  type CategoryRow,
} from '@database/schema';

const getCategoriesQuery = `
     SELECT
         Category.id,
         Category.name,
         Category.sort,
         GROUP_CONCAT(NovelCategory.novelId ORDER BY NovelCategory.novelId) AS novelIds
     FROM Category
     LEFT JOIN NovelCategory ON NovelCategory.categoryId = Category.id
     GROUP BY Category.id, Category.name, Category.sort
     ORDER BY Category.sort;
 	`;

type NumberList = `${number}` | `${number},${number}` | undefined;
/**
 * Get all categories with their novel IDs
 * @deprecated Use getCategoriesFromDbDrizzle for new code
 */
export const getCategoriesFromDb = () => {
  return getAllSync<Category & { novelIds: NumberList }>([getCategoriesQuery]);
};

/**
 * Get all categories with their novel IDs using Drizzle ORM
 */
export const getCategoriesFromDb = (): Array<
  CategoryRow & { novelIds: string | null }
> => {
  return dbManager
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

export const getCategoriesWithCount = (novelIds: number[]) => {
  const getCategoriesWithCountQuery = `
   SELECT *, novelsCount
   FROM Category LEFT JOIN
   (
     SELECT categoryId, COUNT(novelId) as novelsCount
     FROM NovelCategory WHERE novelId in (${novelIds.join(
       ',',
     )}) GROUP BY categoryId
   ) as NC ON Category.id = NC.categoryId
   WHERE Category.id != 2
   ORDER BY sort
 	`;
  return getAllSync<CCategory>([getCategoriesWithCountQuery]);
};

const createCategoryQuery = 'INSERT INTO Category (name) VALUES (?)';

/**
 * Get categories with novel count for the specified novels
 */
export const getCategoriesWithCount = async (
  novelIds: number[],
): Promise<CCategory[]> => {
  if (!novelIds.length) {
    return dbManager
      .select({
        id: categorySchema.id,
        name: categorySchema.name,
        sort: categorySchema.sort,
        novelsCount: sql<number>`0`,
      })
      .from(categorySchema)
      .where(ne(categorySchema.id, 2))
      .orderBy(categorySchema.sort)
      .all() as CCategory[];
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
  return dbManager.write(async tx => {
    const { count: categoryCount } = tx
      .select({ count: count() })
      .from(categorySchema)
      .get() ?? { count: 0 };
    const [row] = tx
      .insert(categorySchema)
      .values({ name: categoryName, sort: categoryCount + 1 })
      .returning()
      .all();
    return row;
  });
};

/**
 * Delete a category by ID with proper handling of novels
 * Before deletion, reassigns novels that only belong to this category to the default category
 */
export const deleteCategoryById = (category: Category): void => {
  if (category.id <= 2) {
    return showToast(getString('categories.cantDeleteDefault'));
  }
  dbManager.write(async tx => {
    const defaultCategoryId = 1;

    // Find novels that only belong to this category
    const novelsWithOnlyThisCategory = tx
      .select({ novelId: novelCategorySchema.novelId })
      .from(novelCategorySchema)
      .groupBy(novelCategorySchema.novelId)
      .having(sql`COUNT(${novelCategorySchema.categoryId}) = 1`)
      .all();

    const novelIds = novelsWithOnlyThisCategory.map(row => row.novelId);

    // Update those novels to belong to the default category
    if (novelIds.length > 0) {
      tx.update(novelCategorySchema)
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
    tx.delete(categorySchema).where(eq(categorySchema.id, category.id)).run();
  });
};

/**
 * Update a category name using Drizzle ORM
 */
export const updateCategory = (
  categoryId: number,
  categoryName: string,
): void => {
  db.runSync(updateCategoryQuery, categoryName, categoryId);
};

/**
 * Update a category name using Drizzle ORM
 */
export const updateCategoryDrizzle = (
  categoryId: number,
  categoryName: string,
): void => {
  dbManager.write(async tx => {
    await tx
      .update(categorySchema)
      .set({ name: categoryName })
      .where(eq(categorySchema.id, categoryId));
  });
};

/**
 * Check if a category name already exists using Drizzle ORM
 */
export const isCategoryNameDuplicate = (categoryName: string): boolean => {
  const result = dbManager
    .select({ id: categorySchema.id })
    .from(categorySchema)
    .where(eq(categorySchema.name, categoryName))
    .get();

  return !!result;
};

/**
 * Update the sort order of categories
 */
export const updateCategoryOrderInDb = (categories: Category[]): void => {
  if (!categories.length) {
    return;
  }

  for (const c of categories) {
    db.runSync(updateCategoryOrderQuery, c.sort, c.id);
  }
};

export const getAllNovelCategories = () =>
  db.getAllSync<NovelCategory>('SELECT * FROM NovelCategory');

export const _restoreCategory = (category: BackupCategory) => {
  db.runSync(
    'DELETE FROM Category WHERE id = ? OR sort = ?',
    category.id,
    category.sort,
  );
  db.runSync(
    'INSERT OR IGNORE INTO Category (id, name, sort) VALUES (?, ?, ?)',
    category.id,
    category.name,
    category.sort,
  );
  for (const novelId of category.novelIds) {
    db.runSync(
      'INSERT OR IGNORE INTO NovelCategory (categoryId, novelId) VALUES (?, ?)',
      category.id,
      novelId,
    );
  }

  dbManager.write(async tx => {
    for (const category of categories) {
      tx.update(categorySchema)
        .set({ sort: category.sort })
        .where(eq(categorySchema.id, category.id))
        .run();
    }
  });
};

/**
 * Get all novel-category associations
 */
export const getAllNovelCategories = (): NovelCategory[] => {
  return dbManager.select().from(novelCategorySchema).all();
};

/**
 * Restore a category from backup
 * Used during the restore process
 */
export const _restoreCategory = (category: BackupCategory): void => {
  dbManager.write(async tx => {
    // Delete existing category with same id or sort
    tx.delete(categorySchema)
      .where(
        sql`${categorySchema.id} = ${category.id} OR ${categorySchema.sort} = ${category.sort}`,
      )
      .run();

    // Insert the category
    tx.insert(categorySchema)
      .values({
        id: category.id,
        name: category.name,
        sort: category.sort,
      })
      .onConflictDoNothing()
      .run();

    // Insert novel-category associations
    if (category.novelIds && category.novelIds.length > 0) {
      for (const novelId of category.novelIds) {
        tx.insert(novelCategorySchema)
          .values({
            categoryId: category.id,
            novelId: novelId,
          })
          .onConflictDoNothing()
          .run();
      }
    }
  });
};
