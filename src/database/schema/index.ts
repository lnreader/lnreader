export { category, type CategoryRow, type CategoryInsert } from './category';
export { novel, type NovelRow, type NovelInsert } from './novel';
export { chapter, type ChapterRow, type ChapterInsert } from './chapter';
export {
  novelCategory,
  type NovelCategoryRow,
  type NovelCategoryInsert,
} from './novelCategory';
export {
  repository,
  type RepositoryRow,
  type RepositoryInsert,
} from './repository';

import { category } from './category';
import { novel } from './novel';
import { chapter } from './chapter';
import { novelCategory } from './novelCategory';
import { repository } from './repository';

/**
 * Unified schema object containing all database tables
 * Use this with Drizzle ORM for type-safe database operations
 */
export const schema = {
  category,
  novel,
  chapter,
  novelCategory,
  repository,
} as const;

export type Schema = typeof schema;
