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

const CHAPTER_FILTER_POSITIVE = {
  downloaded: 'isDownloaded=1',
  read: '`unread`=0',
  bookmarked: 'bookmark=1',
} as const;
const CHAPTER_FILTER_NOT = {
  'not-downloaded': 'isDownloaded=0',
  'not-read': '`unread`=1',
  'not-bookmarked': 'bookmark=0',
} as const;
export const CHAPTER_FILTER = {
  ...CHAPTER_FILTER_POSITIVE,
  ...CHAPTER_FILTER_NOT,
} as const;

export type ChapterFilterPositiveKey = keyof typeof CHAPTER_FILTER_POSITIVE;
export type ChapterFilterKey = keyof typeof CHAPTER_FILTER;
export type ChapterFilter = (typeof CHAPTER_FILTER)[ChapterFilterKey];
