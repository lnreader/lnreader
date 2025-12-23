import * as SQLite from 'expo-sqlite';
import { eq, sql } from 'drizzle-orm';
import { BackupCategory, Category, NovelCategory, CCategory } from '../types';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { db, drizzleDb } from '@database/db';
import { getAllSync, runSync } from '@database/utils/helpers';
import {
  category as categorySchema,
  novelCategory as novelCategorySchema,
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
  return db.getAllSync<Category & { novelIds: NumberList }>(getCategoriesQuery);
};

/**
 * Get all categories with their novel IDs using Drizzle ORM
 */
export const getCategoriesFromDbDrizzle = (): Array<
  CategoryRow & { novelIds: string | null }
> => {
  return drizzleDb
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
  return db.getAllSync<CCategory>(getCategoriesWithCountQuery);
};

const createCategoryQuery = 'INSERT INTO Category (name) VALUES (?)';

/**
 * Create a new category
 * @deprecated Use createCategoryDrizzle for new code
 */
export const createCategory = (categoryName: string): void =>
  runSync([[createCategoryQuery, [categoryName]]]);

/**
 * Create a new category using Drizzle ORM
 */
export const createCategoryDrizzle = (categoryName: string): CategoryRow => {
  const [row] = drizzleDb
    .insert(categorySchema)
    .values({ name: categoryName })
    .returning()
    .all();
  return row;
};

const beforeDeleteCategoryQuery = `
    UPDATE NovelCategory SET categoryId = (SELECT id FROM Category WHERE sort = 1)
    WHERE novelId IN (
      SELECT novelId FROM NovelCategory
      GROUP BY novelId
      HAVING COUNT(categoryId) = 1
    )
    AND categoryId = ?;
`;
const deleteCategoryQuery = 'DELETE FROM Category WHERE id = ?';

export const deleteCategoryById = (category: Category): void => {
  if (category.sort === 1 || category.id === 2) {
    return showToast(getString('categories.cantDeleteDefault'));
  }
  db.runSync(beforeDeleteCategoryQuery, category.id);
  db.runSync(deleteCategoryQuery, category.id);
};

const updateCategoryQuery = 'UPDATE Category SET name = ? WHERE id = ?';

/**
 * Update a category name
 * @deprecated Use updateCategoryDrizzle for new code
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
  drizzleDb
    .update(categorySchema)
    .set({ name: categoryName })
    .where(eq(categorySchema.id, categoryId))
    .run();
};

const isCategoryNameDuplicateQuery = `
  SELECT COUNT(*) as isDuplicate FROM Category WHERE name = ?
	`;

/**
 * Check if a category name already exists
 * @deprecated Use isCategoryNameDuplicateDrizzle for new code
 */
export const isCategoryNameDuplicate = (categoryName: string): boolean => {
  const res = db.getFirstSync(isCategoryNameDuplicateQuery, [categoryName]);

  if (res instanceof Object && 'isDuplicate' in res) {
    return Boolean(res.isDuplicate);
  } else {
    throw 'isCategoryNameDuplicate return type does not match.';
  }
};

/**
 * Check if a category name already exists using Drizzle ORM
 */
export const isCategoryNameDuplicateDrizzle = (
  categoryName: string,
): boolean => {
  const result = drizzleDb
    .select({ id: categorySchema.id })
    .from(categorySchema)
    .where(eq(categorySchema.name, categoryName))
    .get();

  return !!result;
};

const updateCategoryOrderQuery = 'UPDATE Category SET sort = ? WHERE id = ?';

export const updateCategoryOrderInDb = (categories: Category[]): void => {
  // Do not set local as default one
  if (categories.length && categories[0].id === 2) {
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
};
