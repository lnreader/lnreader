import { eq, and, or, gt, isNotNull, isNull, ne } from 'drizzle-orm';
import { dbManager } from '@database/db';
import {
  novelSchema,
  chapterSchema,
  categorySchema,
  novelCategorySchema,
  type NovelInsert,
  type ChapterInsert,
  type ChapterRow,
} from '@database/schema';
import { BUILT_IN_CATEGORY_IDS } from '@database/constants';
import type {
  SyncDevicePayload,
  SyncNovelEntry,
  SyncChapterEntry,
  SyncCategoryEntry,
} from '@services/sync/types';

export interface ActiveSyncEntities {
  novels: SyncNovelEntry[];
  chapters: SyncChapterEntry[];
  categories: SyncCategoryEntry[];
}

/**
 * Queries active entities to be synchronized to Google Drive.
 * Restricts chapters to active states (read, in-progress, bookmarked, or with readTime).
 */
export const queryActiveSyncEntities =
  async (): Promise<ActiveSyncEntities> => {
    const syncableNovelCondition = and(
      eq(novelSchema.inLibrary, true),
      or(eq(novelSchema.isLocal, false), isNull(novelSchema.isLocal)),
      ne(novelSchema.pluginId, 'local'),
    );

    const libraryNovels = await dbManager
      .select()
      .from(novelSchema)
      .where(syncableNovelCondition)
      .all();

    const categoryMap = new Map<number, string[]>();
    const novelCategories = await dbManager
      .select({
        novelId: novelCategorySchema.novelId,
        categoryName: categorySchema.name,
      })
      .from(novelCategorySchema)
      .innerJoin(
        categorySchema,
        eq(categorySchema.id, novelCategorySchema.categoryId),
      )
      .innerJoin(novelSchema, eq(novelSchema.id, novelCategorySchema.novelId))
      .where(syncableNovelCondition)
      .all();

    for (const row of novelCategories) {
      const list = categoryMap.get(row.novelId) ?? [];
      list.push(row.categoryName);
      categoryMap.set(row.novelId, list);
    }

    const novels: SyncNovelEntry[] = libraryNovels.map(novel => ({
      pluginId: novel.pluginId,
      path: novel.path,
      name: novel.name,
      cover: novel.cover ?? null,
      author: novel.author ?? null,
      status: novel.status ?? null,
      inLibrary: Boolean(novel.inLibrary),
      categoryNames: categoryMap.get(novel.id) ?? [],
    }));

    const activeCondition = or(
      eq(chapterSchema.unread, false),
      gt(chapterSchema.progress, 0),
      eq(chapterSchema.bookmark, true),
      isNotNull(chapterSchema.readTime),
      isNotNull(chapterSchema.syncUpdatedAt),
    );

    const activeChapters = await dbManager
      .select({
        novelPluginId: novelSchema.pluginId,
        novelPath: novelSchema.path,
        chapterPath: chapterSchema.path,
        name: chapterSchema.name,
        chapterNumber: chapterSchema.chapterNumber,
        unread: chapterSchema.unread,
        progress: chapterSchema.progress,
        readTime: chapterSchema.readTime,
        bookmark: chapterSchema.bookmark,
        page: chapterSchema.page,
        position: chapterSchema.position,
        syncUpdatedAt: chapterSchema.syncUpdatedAt,
      })
      .from(chapterSchema)
      .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
      .where(and(syncableNovelCondition, activeCondition))
      .all();

    const chapters: SyncChapterEntry[] = activeChapters.map(ch => ({
      novelPluginId: ch.novelPluginId,
      novelPath: ch.novelPath,
      chapterPath: ch.chapterPath,
      name: ch.name,
      chapterNumber: ch.chapterNumber ?? null,
      unread: Boolean(ch.unread),
      progress: sanitizeProgress(ch.progress),
      readTime: ch.readTime ?? null,
      bookmark: Boolean(ch.bookmark),
      page: ch.page ?? null,
      position: ch.position ?? 0,
      syncUpdatedAt: ch.syncUpdatedAt ?? null,
    }));

    const uniqueCategoryNames = new Set<string>();
    for (const names of categoryMap.values()) {
      for (const name of names) {
        uniqueCategoryNames.add(name);
      }
    }

    const categories: SyncCategoryEntry[] = Array.from(uniqueCategoryNames).map(
      name => ({ name }),
    );

    return { novels, chapters, categories };
  };

const sanitizeProgress = (p: unknown): number =>
  typeof p === 'number' && Number.isFinite(p) ? Math.round(p) : 0;

const parseTimestampMs = (time?: string | null): number => {
  if (!time) return NaN;
  const normalized =
    time.includes(' ') && !time.includes('T') ? time.replace(' ', 'T') : time;
  return new Date(normalized).getTime();
};

const isTimestampNewer = (
  remoteTime?: string | null,
  localTime?: string | null,
): boolean => {
  if (!remoteTime) return false;
  if (!localTime) return true;
  const remoteMs = parseTimestampMs(remoteTime);
  const localMs = parseTimestampMs(localTime);
  if (isNaN(remoteMs)) return false;
  if (isNaN(localMs)) return true;
  return remoteMs > localMs;
};

/**
 * Reconciles remote sync payload into the local SQLite database.
 * Executes atomically within dbManager.write without calling dbManager.batch.
 */
export const mergeRemoteSyncPayload = async (
  payload: SyncDevicePayload,
): Promise<void> => {
  await dbManager.write(async tx => {
    // 1. Reconcile novels & categories
    const novelIdMap = new Map<string, number>();

    for (const remoteNovel of payload.novels) {
      if (remoteNovel.pluginId === 'local') {
        continue;
      }
      const key = `${remoteNovel.pluginId}:::${remoteNovel.path}`;
      const existingNovel = await tx
        .select()
        .from(novelSchema)
        .where(
          and(
            eq(novelSchema.pluginId, remoteNovel.pluginId),
            eq(novelSchema.path, remoteNovel.path),
          ),
        )
        .get();

      let novelId: number;
      const isNovelInLibrary = existingNovel
        ? Boolean(existingNovel.inLibrary)
        : true;

      if (!existingNovel) {
        // Novel does not exist locally: insert with inLibrary = true
        const inserted = await tx
          .insert(novelSchema)
          .values({
            pluginId: remoteNovel.pluginId,
            path: remoteNovel.path,
            name: remoteNovel.name,
            cover: remoteNovel.cover ?? null,
            author: remoteNovel.author ?? null,
            status: remoteNovel.status ?? 'Unknown',
            inLibrary: true,
            isLocal: false,
          })
          .returning({ id: novelSchema.id })
          .get();
        novelId = inserted.id;
      } else {
        // Novel exists locally: PRESERVE local.inLibrary unmodified!
        novelId = existingNovel.id;

        const updates: Partial<NovelInsert> = {};
        if (!existingNovel.name && remoteNovel.name) {
          updates.name = remoteNovel.name;
        }
        if (!existingNovel.author && remoteNovel.author) {
          updates.author = remoteNovel.author;
        }
        if (
          (!existingNovel.status || existingNovel.status === 'Unknown') &&
          remoteNovel.status &&
          remoteNovel.status !== 'Unknown'
        ) {
          updates.status = remoteNovel.status;
        }
        if (!existingNovel.cover && remoteNovel.cover) {
          updates.cover = remoteNovel.cover;
        }

        if (Object.keys(updates).length > 0) {
          await tx
            .update(novelSchema)
            .set(updates)
            .where(eq(novelSchema.id, novelId));
        }
      }

      novelIdMap.set(key, novelId);

      // Invariant enforcement: only attach categories & default category to novels when isNovelInLibrary is true
      if (isNovelInLibrary) {
        // Reconcile categories for this novel
        const categoryNames = remoteNovel.categoryNames ?? [];
        if (categoryNames.length > 0) {
          for (const rawCatName of categoryNames) {
            const catName = rawCatName.trim();
            if (!catName) continue;

            let category = await tx
              .select({ id: categorySchema.id })
              .from(categorySchema)
              .where(eq(categorySchema.name, catName))
              .get();

            if (!category) {
              category = await tx
                .insert(categorySchema)
                .values({ name: catName })
                .returning({ id: categorySchema.id })
                .get();
            }

            await tx
              .insert(novelCategorySchema)
              .values({ novelId, categoryId: category.id })
              .onConflictDoNothing();
          }
        }

        // If novel has no category associations, assign built-in default category
        const assignedCategories = await tx
          .select({ id: novelCategorySchema.id })
          .from(novelCategorySchema)
          .where(eq(novelCategorySchema.novelId, novelId))
          .all();

        if (assignedCategories.length === 0) {
          await tx
            .insert(novelCategorySchema)
            .values({
              novelId,
              categoryId: BUILT_IN_CATEGORY_IDS.default,
            })
            .onConflictDoNothing();
        }
      }
    }

    // 2. Reconcile chapters
    const chaptersByNovelKey = new Map<string, SyncChapterEntry[]>();
    for (const remoteChapter of payload.chapters) {
      if (remoteChapter.novelPluginId === 'local') {
        continue;
      }
      const key = `${remoteChapter.novelPluginId}:::${remoteChapter.novelPath}`;
      const list = chaptersByNovelKey.get(key) ?? [];
      list.push(remoteChapter);
      chaptersByNovelKey.set(key, list);
    }

    for (const [key, remoteChapters] of chaptersByNovelKey.entries()) {
      let novelId = novelIdMap.get(key);

      if (novelId === undefined) {
        const pluginId = remoteChapters[0].novelPluginId;
        const path = remoteChapters[0].novelPath;
        const existingNovel = await tx
          .select({ id: novelSchema.id })
          .from(novelSchema)
          .where(
            and(eq(novelSchema.pluginId, pluginId), eq(novelSchema.path, path)),
          )
          .get();

        if (existingNovel) {
          novelId = existingNovel.id;
          novelIdMap.set(key, novelId);
        } else {
          continue; // Chapter belongs to unknown novel, skip
        }
      }

      const localChapters = await tx
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, novelId))
        .all();

      const localChapterMap = new Map<string, ChapterRow>();
      for (const ch of localChapters) {
        localChapterMap.set(ch.path, ch);
      }

      const chaptersToInsert: ChapterInsert[] = [];
      const seenInsertPaths = new Set<string>();

      for (const remoteChapter of remoteChapters) {
        const local = localChapterMap.get(remoteChapter.chapterPath);

        if (!local) {
          if (seenInsertPaths.has(remoteChapter.chapterPath)) {
            continue;
          }
          seenInsertPaths.add(remoteChapter.chapterPath);
          chaptersToInsert.push({
            novelId,
            path: remoteChapter.chapterPath,
            name: remoteChapter.name,
            chapterNumber: remoteChapter.chapterNumber ?? null,
            unread: remoteChapter.unread,
            progress: sanitizeProgress(remoteChapter.progress),
            readTime: remoteChapter.readTime ?? null,
            bookmark: Boolean(remoteChapter.bookmark),
            page: remoteChapter.page ?? '1',
            position: remoteChapter.position ?? 0,
            syncUpdatedAt: remoteChapter.syncUpdatedAt ?? null,
            isDownloaded: false,
          });
        } else {
          const remoteProgress = sanitizeProgress(remoteChapter.progress);
          const effectiveRemoteTime =
            remoteChapter.syncUpdatedAt ?? remoteChapter.readTime;
          const effectiveLocalTime = local.syncUpdatedAt ?? local.readTime;

          const remoteHasExplicitEdit = Boolean(remoteChapter.syncUpdatedAt);
          const localHasExplicitEdit = Boolean(local.syncUpdatedAt);
          const remoteStateIsNewer = isTimestampNewer(
            effectiveRemoteTime,
            effectiveLocalTime,
          );
          const localStateIsNewer = isTimestampNewer(
            effectiveLocalTime,
            effectiveRemoteTime,
          );

          let updatedUnread: boolean;
          let updatedProgress: number;
          let updatedBookmark: boolean;
          let updatedSyncUpdatedAt: string | null;

          if (remoteHasExplicitEdit && remoteStateIsNewer) {
            updatedUnread = Boolean(remoteChapter.unread);
            updatedProgress = remoteProgress;
            updatedBookmark = Boolean(remoteChapter.bookmark);
            updatedSyncUpdatedAt = remoteChapter.syncUpdatedAt ?? null;
          } else if (localHasExplicitEdit && localStateIsNewer) {
            updatedUnread = Boolean(local.unread);
            updatedProgress = local.progress ?? 0;
            updatedBookmark = Boolean(local.bookmark);
            updatedSyncUpdatedAt = local.syncUpdatedAt ?? null;
          } else {
            updatedUnread =
              local.unread === false ? false : Boolean(remoteChapter.unread);
            updatedProgress = Math.max(local.progress ?? 0, remoteProgress);
            updatedBookmark =
              Boolean(local.bookmark) || Boolean(remoteChapter.bookmark);
            updatedSyncUpdatedAt = isTimestampNewer(
              remoteChapter.syncUpdatedAt,
              local.syncUpdatedAt,
            )
              ? remoteChapter.syncUpdatedAt ?? null
              : local.syncUpdatedAt ?? null;
          }

          const remoteIsNewer = isTimestampNewer(
            remoteChapter.readTime,
            local.readTime,
          );
          const updatedReadTime = remoteIsNewer
            ? remoteChapter.readTime ?? local.readTime
            : local.readTime;
          const updatedPage =
            remoteIsNewer && remoteChapter.page
              ? remoteChapter.page
              : local.page;

          const hasChanged =
            Boolean(local.unread) !== updatedUnread ||
            (local.progress ?? 0) !== updatedProgress ||
            Boolean(local.bookmark) !== updatedBookmark ||
            (local.readTime ?? null) !== (updatedReadTime ?? null) ||
            (local.page ?? '1') !== (updatedPage ?? '1') ||
            (local.syncUpdatedAt ?? null) !== (updatedSyncUpdatedAt ?? null);

          if (hasChanged) {
            await tx
              .update(chapterSchema)
              .set({
                unread: updatedUnread,
                progress: updatedProgress,
                bookmark: updatedBookmark,
                readTime: updatedReadTime,
                page: updatedPage,
                syncUpdatedAt: updatedSyncUpdatedAt,
              })
              .where(eq(chapterSchema.id, local.id));
          }
        }
      }

      for (let i = 0; i < chaptersToInsert.length; i += 100) {
        const chunk = chaptersToInsert.slice(i, i + 100);
        await tx.insert(chapterSchema).values(chunk).onConflictDoNothing();
      }
    }
  });
};
