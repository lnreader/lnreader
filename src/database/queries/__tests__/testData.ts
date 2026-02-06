/**
 * Test data utilities for inserting test data into database
 */

import type { TestDb } from './testDb';
import {
  novelSchema,
  chapterSchema,
  categorySchema,
  repositorySchema,
  novelCategorySchema,
  type NovelInsert,
  type ChapterInsert,
  type CategoryInsert,
  type RepositoryInsert,
  type NovelCategoryInsert,
} from '@database/schema';

/**
 * Clears all tables in the test database
 */
export function clearAllTables(testDb: TestDb) {
  const { sqlite } = testDb;
  sqlite.exec(`
    DELETE FROM NovelCategory;
    DELETE FROM Chapter;
    DELETE FROM Novel;
    DELETE FROM Repository;
    DELETE FROM Category WHERE id > 2;
  `);
}

/**
 * Inserts a test novel into the database
 */
export async function insertTestNovel(
  testDb: TestDb,
  data: Partial<NovelInsert> = {},
): Promise<number> {
  const { drizzleDb } = testDb;

  const novelData: any = {
    path: `/test/novel/${Math.random()}`,
    pluginId: 'test-plugin',
    name: 'Test Novel',
    cover: null,
    summary: null,
    author: null,
    artist: null,
    status: 'Unknown',
    genres: null,
    inLibrary: false,
    isLocal: false,
    totalPages: 0,
    chaptersDownloaded: 0,
    chaptersUnread: 0,
    totalChapters: 0,
    lastReadAt: null,
    lastUpdatedAt: null,
    ...data,
  };

  const result = drizzleDb
    .insert(novelSchema)
    .values(novelData)
    .returning()
    .get();

  return result.id;
}

/**
 * Inserts a test chapter into the database
 */
export async function insertTestChapter(
  testDb: TestDb,
  novelId: number,
  data: Partial<ChapterInsert> = {},
): Promise<number> {
  const { drizzleDb } = testDb;

  const chapterData: any = {
    path: `/test/chapter/${Math.random()}`,
    name: 'Test Chapter',
    releaseTime: null,
    bookmark: false,
    unread: true,
    readTime: null,
    isDownloaded: false,
    updatedTime: null,
    chapterNumber: null,
    page: '1',
    position: 0,
    progress: null,
    ...data,
    novelId,
  };

  const result = drizzleDb
    .insert(chapterSchema)
    .values(chapterData)
    .returning()
    .get();

  return result.id;
}

/**
 * Inserts a test category into the database
 */
export async function insertTestCategory(
  testDb: TestDb,
  data: Partial<CategoryInsert> = {},
): Promise<number> {
  const { drizzleDb } = testDb;
  const categoryData: CategoryInsert = {
    name: data.name ?? `Test Category ${Date.now()}`,
    sort: data.sort ?? null,
  };

  const result = drizzleDb
    .insert(categorySchema)
    .values(categoryData)
    .returning()
    .get();

  return result.id;
}

/**
 * Inserts a test repository into the database
 */
export async function insertTestRepository(
  testDb: TestDb,
  data: Partial<RepositoryInsert> = {},
): Promise<number> {
  const { drizzleDb } = testDb;
  const repoData: RepositoryInsert = {
    url: data.url ?? `https://test-repo-${Date.now()}.example.com`,
  };

  const result = drizzleDb
    .insert(repositorySchema)
    .values(repoData)
    .returning()
    .get();

  return result.id;
}

/**
 * Inserts a novel-category association
 */
export async function insertTestNovelCategory(
  testDb: TestDb,
  novelId: number,
  categoryId: number,
): Promise<number> {
  const { drizzleDb } = testDb;
  const data: NovelCategoryInsert = {
    novelId,
    categoryId,
  };

  const result = drizzleDb
    .insert(novelCategorySchema)
    .values(data)
    .returning()
    .get();

  return result.id;
}

/**
 * Inserts a novel with optional chapters
 */
export async function insertTestNovelWithChapters(
  testDb: TestDb,
  novelData: Partial<NovelInsert> = {},
  chapters: Partial<ChapterInsert>[] = [],
): Promise<{ novelId: number; chapterIds: number[] }> {
  const novelId = await insertTestNovel(testDb, novelData);
  const chapterIds: number[] = [];

  for (const chapterData of chapters) {
    const chapterId = await insertTestChapter(testDb, novelId, chapterData);
    chapterIds.push(chapterId);
  }

  return { novelId, chapterIds };
}

/**
 * Bulk insert test data
 */
export interface TestFixtures {
  novels?: Partial<NovelInsert>[];
  chapters?: Array<{ novelId: number } & Partial<ChapterInsert>>;
  categories?: Partial<CategoryInsert>[];
  repositories?: Partial<RepositoryInsert>[];
  novelCategories?: Array<{ novelId: number; categoryId: number }>;
}

export async function seedTestData(
  testDb: TestDb,
  fixtures: TestFixtures,
): Promise<{
  novelIds: number[];
  chapterIds: number[];
  categoryIds: number[];
  repositoryIds: number[];
}> {
  const novelIds: number[] = [];
  const chapterIds: number[] = [];
  const categoryIds: number[] = [];
  const repositoryIds: number[] = [];

  // Insert novels
  if (fixtures.novels) {
    for (const novelData of fixtures.novels) {
      const id = await insertTestNovel(testDb, novelData);
      novelIds.push(id);
    }
  }

  // Insert chapters (can reference novels by index or use provided novelId)
  if (fixtures.chapters) {
    for (const chapterData of fixtures.chapters) {
      const { novelId, ...rest } = chapterData;
      const id = await insertTestChapter(testDb, novelId, rest);
      chapterIds.push(id);
    }
  }

  // Insert categories
  if (fixtures.categories) {
    for (const categoryData of fixtures.categories) {
      const id = await insertTestCategory(testDb, categoryData);
      categoryIds.push(id);
    }
  }

  // Insert repositories
  if (fixtures.repositories) {
    for (const repoData of fixtures.repositories) {
      const id = await insertTestRepository(testDb, repoData);
      repositoryIds.push(id);
    }
  }

  // Insert novel-category associations
  if (fixtures.novelCategories) {
    for (const { novelId, categoryId } of fixtures.novelCategories) {
      await insertTestNovelCategory(testDb, novelId, categoryId);
    }
  }

  return { novelIds, chapterIds, categoryIds, repositoryIds };
}
