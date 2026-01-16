import { countBy } from 'lodash-es';
import { db } from '@database/db';
import { LibraryStats } from '../types';

const getLibraryStatsQuery = `
  SELECT COUNT(*) as novelsCount, COUNT(DISTINCT pluginId) as sourcesCount
  FROM Novel
  WHERE inLibrary = 1
  `;

const getChaptersReadCountQuery = `
  SELECT COUNT(*) as chaptersRead
  FROM Chapter
  JOIN Novel
  ON Chapter.novelId = Novel.id
  WHERE Chapter.unread = 0 AND Novel.inLibrary = 1
  `;

const getChaptersTotalCountQuery = `
  SELECT COUNT(*) as chaptersCount
  FROM Chapter
  JOIN Novel
  ON Chapter.novelId = Novel.id
  WHERE Novel.inLibrary = 1
  `;

const getChaptersUnreadCountQuery = `
  SELECT COUNT(*) as chaptersUnread
  FROM Chapter
  JOIN Novel
  ON Chapter.novelId = Novel.id
  WHERE Chapter.unread = 1 AND Novel.inLibrary = 1
  `;

const getChaptersDownloadedCountQuery = `
  SELECT COUNT(*) as chaptersDownloaded
  FROM Chapter
  JOIN Novel
  ON Chapter.novelId = Novel.id
  WHERE Chapter.isDownloaded = 1 AND Novel.inLibrary = 1
  `;

const getNovelGenresQuery = `
  SELECT genres
  FROM Novel
  WHERE Novel.inLibrary = 1
  `;

const getNovelStatusQuery = `
  SELECT status
  FROM Novel
  WHERE Novel.inLibrary = 1
  `;

export const getLibraryStatsFromDb = (): Promise<LibraryStats | null> => {
  return db.getFirstAsync<LibraryStats>(getLibraryStatsQuery);
};

export const getChaptersTotalCountFromDb = (): Promise<LibraryStats | null> => {
  return db.getFirstAsync<LibraryStats>(getChaptersTotalCountQuery);
};

export const getChaptersReadCountFromDb = (): Promise<LibraryStats | null> => {
  return db.getFirstAsync<LibraryStats>(getChaptersReadCountQuery);
};

export const getChaptersUnreadCountFromDb =
  (): Promise<LibraryStats | null> => {
    return db.getFirstAsync<LibraryStats>(getChaptersUnreadCountQuery);
  };

export const getChaptersDownloadedCountFromDb =
  (): Promise<LibraryStats | null> => {
    return db.getFirstAsync<LibraryStats>(getChaptersDownloadedCountQuery);
  };

export const getNovelGenresFromDb = async (): Promise<LibraryStats> => {
  const genres: string[] = [];
  const res = await db.getAllAsync<{ genres: string }>(getNovelGenresQuery);
  res.forEach(item => {
    const novelGenres = item.genres?.split(/\s*,\s*/);
    if (novelGenres?.length) {
      genres.push(...novelGenres);
    }
  });
  return { genres: countBy(genres) };
};

export const getNovelStatusFromDb = async (): Promise<LibraryStats> => {
  const status: string[] = [];
  const res = await db.getAllAsync<{ status: string }>(getNovelStatusQuery);
  res.forEach(item => {
    const novelStatus = item.status?.split(/\s*,\s*/);
    if (novelStatus?.length) {
      status.push(...novelStatus);
    }
  });
  return { status: countBy(status) };
};
