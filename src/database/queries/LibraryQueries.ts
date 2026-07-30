import {
  eq,
  gt,
  sql,
  and,
  like,
  or,
  inArray,
  exists,
  notExists,
  isNotNull,
  ne,
} from 'drizzle-orm';
import { dbManager } from '@database/db';
import { novelSchema, novelCategorySchema } from '@database/schema';
import { castInt } from '@database/manager/manager';
import type {
  GlobalUpdateCategoryFilters,
  SmartUpdateFilters,
} from '@hooks/persisted/useSettings';

const smartUpdateConditions = ({
  skipCompleted,
  skipUnstarted,
  skipWithUnread,
}: SmartUpdateFilters) => [
  skipWithUnread
    ? sql`COALESCE(${novelSchema.chaptersUnread}, 0) = 0`
    : undefined,
  skipUnstarted ? isNotNull(novelSchema.lastReadAt) : undefined,
  skipCompleted ? ne(novelSchema.status, 'Completed') : undefined,
];

/**
 * Get library novels with optional filtering and sorting using Drizzle ORM
 */
export const getLibraryNovelsFromDb = (
  sortOrder?: string,
  filter?: string,
  searchText?: string,
  downloadedOnlyMode?: boolean,
  excludeLocalNovels?: boolean,
) => {
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
              gt(novelSchema.chaptersDownloaded, castInt(0)),
              eq(novelSchema.isLocal, true),
            )
          : undefined,
        searchText ? like(novelSchema.name, `%${searchText}%`) : undefined,
      ),
    )
    .$dynamic();

  if (sortOrder) {
    const dateAwareSortOrder = sortOrder.replace(
      /^lastUpdatedAt (ASC|DESC)$/,
      'julianday(lastUpdatedAt) $1',
    );
    query.orderBy(sql.raw(dateAwareSortOrder));
  }

  return query.all();
};

/**
 * Get the novels eligible for a global update in one query.
 * An empty include list means all categories, while exclusions always win.
 */
export const getLibraryNovelsForGlobalUpdate = (
  { includedCategoryIds, excludedCategoryIds }: GlobalUpdateCategoryFilters,
  smartUpdateFilters: SmartUpdateFilters = {
    skipCompleted: false,
    skipUnstarted: false,
    skipWithUnread: false,
  },
) => {
  const includedNovel = includedCategoryIds.length
    ? dbManager
        .select({ novelId: novelCategorySchema.novelId })
        .from(novelCategorySchema)
        .where(
          and(
            eq(novelCategorySchema.novelId, novelSchema.id),
            inArray(novelCategorySchema.categoryId, includedCategoryIds),
          ),
        )
    : undefined;
  const excludedNovel = excludedCategoryIds.length
    ? dbManager
        .select({ novelId: novelCategorySchema.novelId })
        .from(novelCategorySchema)
        .where(
          and(
            eq(novelCategorySchema.novelId, novelSchema.id),
            inArray(novelCategorySchema.categoryId, excludedCategoryIds),
          ),
        )
    : undefined;

  return dbManager
    .select()
    .from(novelSchema)
    .where(
      and(
        eq(novelSchema.inLibrary, true),
        eq(novelSchema.isLocal, false),
        includedNovel ? exists(includedNovel) : undefined,
        excludedNovel ? notExists(excludedNovel) : undefined,
        ...smartUpdateConditions(smartUpdateFilters),
      ),
    )
    .all();
};

/**
 * Get library novels associated with a specific category using Drizzle ORM
 */
export const getLibraryWithCategory = async (
  categoryId?: number | null,
  excludeLocalNovels?: boolean,
) => {
  // First, get novel IDs associated with the specified category
  const categoryIdQuery = dbManager
    .selectDistinct({ novelId: novelCategorySchema.novelId })
    .from(novelCategorySchema)
    .$dynamic();

  if (categoryId) {
    categoryIdQuery.where(eq(novelCategorySchema.categoryId, categoryId));
  }

  const idRows = await categoryIdQuery.all();

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
      ),
    )
    .all();

  return result;
};
