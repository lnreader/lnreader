import { LibraryNovelInfo, NovelInfo } from '../types';
import { eq, sql, and, like, or, inArray } from 'drizzle-orm';
import { dbManager } from '@database/db';
import {
  novel as novelSchema,
  novelCategory as novelCategorySchema,
} from '@database/schema';
import { NovelInfo, LibraryNovelInfo } from '../types';

/**
 * Get library novels with optional filtering and sorting using Drizzle ORM
 */
export const getLibraryNovelsFromDb = (
  sortOrder?: string,
  filter?: string,
  searchText?: string,
  downloadedOnlyMode?: boolean,
  excludeLocalNovels?: boolean,
): NovelInfo[] => {
  const query = dbManager
    .select()
    .from(novelSchema)
    .where(
      and(
        eq(novelSchema.inLibrary, true),
        excludeLocalNovels ? eq(novelSchema.isLocal, false) : undefined,
        filter ? sql.raw(filter) : undefined,
        downloadedOnlyMode
          ? or(
              eq(novelSchema.chaptersDownloaded, 1),
              eq(novelSchema.isLocal, true),
            )
          : undefined,
        searchText ? like(novelSchema.name, `%${searchText}%`) : undefined,
      ),
    )
    .$dynamic();

  if (sortOrder) {
    query.orderBy(sql.raw(sortOrder));
  }

  return query.all();
};

/**
 * Get library novels associated with a specific category using Drizzle ORM
 */
export const getLibraryWithCategory = (
  categoryId?: number | null,
  onlyUpdateOngoingNovels?: boolean,
  excludeLocalNovels?: boolean,
): LibraryNovelInfo[] => {
  // First, get novel IDs associated with the specified category
  const categoryIdQuery = dbManager
    .selectDistinct({ novelId: novelCategorySchema.novelId })
    .from(novelCategorySchema)
    .$dynamic();

  if (categoryId) {
    categoryIdQuery.where(eq(novelCategorySchema.categoryId, categoryId));
  }

  const idRows = categoryIdQuery.all();

  if (!idRows || idRows.length === 0) {
    return [];
  }

  const novelIds = idRows.map(r => r.novelId);

  // Then, fetch the library novels matching those IDs and other criteria
  const result = dbManager
    .select()
    .from(novelSchema)
    .where(
      and(
        eq(novelSchema.inLibrary, true),
        inArray(novelSchema.id, novelIds),
        excludeLocalNovels ? eq(novelSchema.isLocal, false) : undefined,
        onlyUpdateOngoingNovels ? eq(novelSchema.status, 'Ongoing') : undefined,
      ),
    )
    .all();

  return result as LibraryNovelInfo[];
};
