import { desc, eq, inArray, sql } from 'drizzle-orm';
import {
  category,
  chapter,
  novel,
  novelCategory,
  repository,
  type CategoryRow,
  type ChapterInsert,
  type ChapterRow,
  type NovelInsert,
  type NovelRow,
  type RepositoryInsert,
  type RepositoryRow,
} from './schema';
import { type QueryCatalog, type QueryId, type QuerySpec } from './types';

const defineQuery = <P, R>(spec: QuerySpec<P, R>): QuerySpec<P, R> => spec;

export const queryCatalog = {
  createCategory: defineQuery<{ name: string }, CategoryRow>({
    id: 'createCategory',
    kind: 'write',
    description: 'Insert a new category',
    run: async ({ db }, params) => {
      const [row] = await db
        .insert(category)
        .values({ name: params.name })
        .returning();
      return row;
    },
  }),

  listCategories: defineQuery<
    void,
    Array<CategoryRow & { novelsCount: number }>
  >({
    id: 'listCategories',
    kind: 'read',
    description: 'List categories with aggregated novel counts',
    run: async ({ db }) => {
      const rows = await db
        .select({
          id: category.id,
          name: category.name,
          sort: category.sort,
          novelsCount: sql<number>`count(${novelCategory.novelId})`,
        })
        .from(category)
        .leftJoin(novelCategory, eq(novelCategory.categoryId, category.id))
        .groupBy(category.id)
        .orderBy(category.sort, category.id);

      return rows.map((row: any) => ({
        ...row,
        novelsCount: Number(row.novelsCount ?? 0),
      }));
    },
  }),

  upsertNovel: defineQuery<NovelInsert, NovelRow>({
    id: 'upsertNovel',
    kind: 'write',
    description: 'Insert or update a novel by path + pluginId',
    run: async ({ db }, novelParams) => {
      const [row] = await db
        .insert(novel)
        .values(novelParams)
        .onConflictDoUpdate({
          target: [novel.path, novel.pluginId],
          set: {
            name: novelParams.name,
            cover: novelParams.cover,
            summary: novelParams.summary,
            author: novelParams.author,
            artist: novelParams.artist,
            status: novelParams.status,
            genres: novelParams.genres,
            inLibrary: novelParams.inLibrary,
            isLocal: novelParams.isLocal,
            totalPages: novelParams.totalPages,
          },
        })
        .returning();

      return row;
    },
  }),

  insertChapters: defineQuery<
    { novelId: number; chapters: ChapterInsert[] },
    { inserted: number }
  >({
    id: 'insertChapters',
    kind: 'write',
    description: 'Batch insert chapters for a novel; ignores duplicates',
    run: async ({ db }, { novelId, chapters: values }) => {
      if (!values.length) {
        return { inserted: 0 };
      }

      const toInsert = values.map(ch => ({ ...ch, novelId }));
      const result = await db
        .insert(chapter)
        .values(toInsert)
        .onConflictDoNothing({
          target: [chapter.novelId, chapter.path],
        });

      const changes =
        typeof result.changes === 'number'
          ? result.changes
          : Array.isArray(result)
          ? result.length
          : 0;

      return { inserted: changes };
    },
  }),

  chaptersByNovel: defineQuery<{ novelId: number }, ChapterRow[]>({
    id: 'chaptersByNovel',
    kind: 'read',
    description: 'Fetch chapters for a novel ordered by position then id',
    run: async ({ db }, { novelId }) => {
      return db
        .select()
        .from(chapter)
        .where(eq(chapter.novelId, novelId))
        .orderBy(chapter.position, chapter.id);
    },
  }),

  markChapterProgress: defineQuery<
    {
      chapterId: number;
      progress: number;
      position?: number;
      unread?: boolean;
    },
    { updated: number }
  >({
    id: 'markChapterProgress',
    kind: 'write',
    description: 'Update chapter progress and optionally unread state',
    run: async ({ db }, { chapterId, progress, position, unread }) => {
      const update: Record<string, unknown> = {
        progress,
        readTime: sql`CURRENT_TIMESTAMP`,
      };

      if (typeof position === 'number') {
        update.position = position;
      }
      if (typeof unread === 'boolean') {
        update.unread = unread;
      }

      const result = await db
        .update(chapter)
        .set(update)
        .where(eq(chapter.id, chapterId));

      const updated =
        typeof result.changes === 'number'
          ? result.changes
          : Array.isArray(result)
          ? result.length
          : 0;

      return { updated };
    },
  }),

  attachNovelToCategories: defineQuery<
    { novelId: number; categoryIds: number[] },
    { inserted: number }
  >({
    id: 'attachNovelToCategories',
    kind: 'write',
    description: 'Attach novel to multiple categories, ignoring duplicates',
    run: async ({ db }, { novelId, categoryIds }) => {
      if (!categoryIds.length) return { inserted: 0 };

      const payload = categoryIds.map(categoryId => ({ categoryId, novelId }));
      const result = await db
        .insert(novelCategory)
        .values(payload)
        .onConflictDoNothing({
          target: [novelCategory.novelId, novelCategory.categoryId],
        });

      const inserted =
        typeof result.changes === 'number'
          ? result.changes
          : Array.isArray(result)
          ? result.length
          : 0;

      return { inserted };
    },
  }),

  novelsByIds: defineQuery<{ ids: number[] }, NovelRow[]>({
    id: 'novelsByIds',
    kind: 'read',
    description: 'Fetch novels for a set of ids',
    run: async ({ db }, { ids }) => {
      if (!ids.length) return [];
      return db
        .select()
        .from(novel)
        .where(inArray(novel.id, ids))
        .orderBy(desc(novel.lastUpdatedAt), desc(novel.id));
    },
  }),

  registerRepository: defineQuery<RepositoryInsert, RepositoryRow>({
    id: 'registerRepository',
    kind: 'write',
    description: 'Register a plugin repository; ignores duplicates',
    run: async ({ db }, params) => {
      const [row] = await db
        .insert(repository)
        .values({ url: params.url })
        .onConflictDoNothing({ target: repository.url })
        .returning();
      return row;
    },
  }),
} as const satisfies QueryCatalog;

export type DatabaseQueryCatalog = typeof queryCatalog;
export type DatabaseQueryId = QueryId<DatabaseQueryCatalog>;
