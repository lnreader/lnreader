import { getNovelById, getNovelByPath } from '@database/queries/NovelQueries';

export type MigrationTarget = {
  fromNovelId: number;
  pluginId: string;
  toNovelPath: string;
};

/**
 * A migration only counts as done once the destination novel is in the library
 * and the source novel is gone; the migration writes both in one transaction.
 */
export const isMigrationPersisted = ({
  fromNovelId,
  pluginId,
  toNovelPath,
}: MigrationTarget) =>
  // The sync getters return raw rows, where inLibrary is 0/1, not a boolean.
  Boolean(getNovelByPath(toNovelPath, pluginId)?.inLibrary) &&
  getNovelById(fromNovelId) === undefined;
