import { LibraryNovelInfo, NovelInfo } from '../types';
import { getAllSync, getAllSyncReadOnly } from '../utils/helpers';

export const getLibraryNovelsFromDb = (
  sortOrder?: string,
  filter?: string,
  searchText?: string,
  downloadedOnlyMode?: boolean,
  excludeLocalNovels?: boolean,
): NovelInfo[] => {
  let query = 'SELECT * FROM Novel WHERE inLibrary = 1';

  if (excludeLocalNovels) {
    query += ' AND isLocal = 0';
  }

  if (filter) {
    query += ` AND ${filter}`;
  }

  if (downloadedOnlyMode) {
    query += ` AND (chaptersDownloaded > 0 OR isLocal = 1)`;
  }

  if (searchText) {
    query += ' AND name LIKE ?';
  }

  if (sortOrder) {
    query += ` ORDER BY ${sortOrder}`;
  }

  return getAllSyncReadOnly<NovelInfo>([query, [searchText ?? '']]);
};

/**
 * Get library novels for a specific category.
 * Uses a single JOIN query (inspired by Mihon's libraryView) instead of
 * two separate queries, reducing DB round-trips.
 */
export const getLibraryWithCategory = (
  categoryId?: number | null,
  onlyUpdateOngoingNovels?: boolean,
  excludeLocalNovels?: boolean,
): LibraryNovelInfo[] => {
  let query = `
    SELECT DISTINCT Novel.* FROM Novel
    INNER JOIN NovelCategory ON NovelCategory.novelId = Novel.id
    WHERE Novel.inLibrary = 1`;

  const params: (string | number)[] = [];

  if (categoryId) {
    query += ' AND NovelCategory.categoryId = ?';
    params.push(categoryId);
  }

  if (excludeLocalNovels) {
    query += ' AND Novel.isLocal = 0';
  }

  if (onlyUpdateOngoingNovels) {
    query += " AND Novel.status = 'Ongoing'";
  }

  return getAllSyncReadOnly<LibraryNovelInfo>([query, params]);
};
