export const CHAPTER_ORDER = {
  readTimeAsc: 'readTime ASC',
  readTimeDesc: 'readTime DESC',
  positionAsc: 'position ASC',
  positionDesc: 'position DESC',
  nameAsc: 'name ASC',
  nameDesc: 'name DESC',
} as const;

export type ChapterOrderKey = keyof typeof CHAPTER_ORDER;
export type ChapterOrder = (typeof CHAPTER_ORDER)[ChapterOrderKey];

export const CHAPTER_FILTER = {
  downloaded: 'isDownloaded=1',
  notDownloaded: 'isDownloaded=0',
  unread: '`unread`=1',
  read: '`unread`=0',
  bookmarked: 'bookmark=1',
} as const;

export type ChapterFilterKey = keyof typeof CHAPTER_FILTER;
export type ChapterFilter = (typeof CHAPTER_FILTER)[ChapterFilterKey];
