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
  isNull,
  ne,
  gte,
  lt,
  asc,
  count,
  SQL,
} from 'drizzle-orm';
import { dbManager } from '@database/db';
import { novelSchema, novelCategorySchema } from '@database/schema';
import { castInt } from '@database/manager/manager';
import type {
  GlobalUpdateCategoryFilters,
  SmartUpdateFilters,
} from '@hooks/persisted/useSettings';
import { NovelStatus } from '@plugins/types';
import type {
  LibraryFilterKey,
  LibraryFilters,
} from '@screens/library/constants/constants';

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

const isDownloaded = () =>
  or(
    gt(novelSchema.chaptersDownloaded, castInt(0)),
    eq(novelSchema.isLocal, true),
  );

const libraryFilterConditions: Record<LibraryFilterKey, () => SQL | undefined> =
  {
    downloaded: isDownloaded,
    unread: () => isNull(novelSchema.lastReadAt),
    started: () => isNotNull(novelSchema.lastReadAt),
    completed: () => like(novelSchema.status, 'Completed'),
    customUpdateFrequency: () => lt(novelSchema.fetchInterval, castInt(0)),
  };

/** Every set filter must hold; an excluded one matches what it would not. */
const libraryFiltersConditions = (
  filters: LibraryFilters,
  downloadedOnlyMode?: boolean,
) =>
  (Object.keys(libraryFilterConditions) as LibraryFilterKey[]).map(key => {
    const state = filters[key];
    // Downloaded-only mode already includes downloaded novels.
    if (!state || (key === 'downloaded' && downloadedOnlyMode)) {
      return undefined;
    }
    const condition = libraryFilterConditions[key]();
    // A NULL column fails both a condition and its NOT, so treat it as false.
    return state === 'exclude' ? sql`NOT COALESCE(${condition}, 0)` : condition;
  });

/**
 * Get library novels with optional filtering and sorting using Drizzle ORM
 */
export const getLibraryNovelsQuery = (
  sortOrder?: string,
  filters: LibraryFilters = {},
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
        ...libraryFiltersConditions(filters, downloadedOnlyMode),
        downloadedOnlyMode ? isDownloaded() : undefined,
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

  return query;
};

export const getLibraryNovelsFromDb = (
  sortOrder?: string,
  filters?: LibraryFilters,
  searchText?: string,
  downloadedOnlyMode?: boolean,
  excludeLocalNovels?: boolean,
) =>
  getLibraryNovelsQuery(
    sortOrder,
    filters,
    searchText,
    downloadedOnlyMode,
    excludeLocalNovels,
  ).all();

/** Each distinct `genres` value in the library, with how many novels use it. */
export const getLibraryGenresFromDb = () =>
  dbManager
    .select({ genres: novelSchema.genres, novelCount: count() })
    .from(novelSchema)
    .where(
      and(
        eq(novelSchema.inLibrary, true),
        isNotNull(novelSchema.genres),
        ne(novelSchema.genres, ''),
      ),
    )
    .groupBy(novelSchema.genres)
    .all();

const inCategories = (categoryIds: number[]) =>
  dbManager
    .select({ novelId: novelCategorySchema.novelId })
    .from(novelCategorySchema)
    .where(
      and(
        eq(novelCategorySchema.novelId, novelSchema.id),
        inArray(novelCategorySchema.categoryId, categoryIds),
      ),
    );

/** An empty include list means all categories, while exclusions always win. */
const categoryConditions = ({
  includedCategoryIds,
  excludedCategoryIds,
}: GlobalUpdateCategoryFilters) => [
  includedCategoryIds.length
    ? exists(inCategories(includedCategoryIds))
    : undefined,
  excludedCategoryIds.length
    ? notExists(inCategories(excludedCategoryIds))
    : undefined,
];

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
  return dbManager
    .select()
    .from(novelSchema)
    .where(
      and(
        eq(novelSchema.inLibrary, true),
        eq(novelSchema.isLocal, false),
        ...categoryConditions({ includedCategoryIds, excludedCategoryIds }),
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

/** Plugins often report Unknown, so only statuses that can't release again are left out. */
const UPCOMING_STATUSES: string[] = [
  NovelStatus.Ongoing,
  NovelStatus.Unknown,
  NovelStatus.PublishingFinished,
];

/**
 * Library novels predicted to update on or after [startOfToday], soonest first,
 * for the Upcoming screen.
 */
export const getUpcomingNovelsQuery = (
  categoryFilters: GlobalUpdateCategoryFilters,
  startOfToday: string,
) =>
  dbManager
    .select({
      id: novelSchema.id,
      name: novelSchema.name,
      path: novelSchema.path,
      pluginId: novelSchema.pluginId,
      cover: novelSchema.cover,
      nextUpdate: novelSchema.nextUpdate,
    })
    .from(novelSchema)
    .where(
      and(
        eq(novelSchema.inLibrary, true),
        eq(novelSchema.isLocal, false),
        gte(novelSchema.nextUpdate, startOfToday),
        or(
          isNull(novelSchema.status),
          inArray(novelSchema.status, UPCOMING_STATUSES),
        ),
        ...categoryConditions(categoryFilters),
      ),
    )
    .orderBy(asc(novelSchema.nextUpdate), asc(novelSchema.name));

export type UpcomingNovel = Awaited<
  ReturnType<ReturnType<typeof getUpcomingNovelsQuery>['all']>
>[number];
