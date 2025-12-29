import { NovelStatus } from '@plugins/types';

export interface NovelInfo {
  id: number;
  path: string;
  pluginId: string;
  name: string;
  cover?: string | null;
  summary?: string | null;
  author?: string | null;
  artist?: string | null;
  status?: NovelStatus | string | null;
  genres?: string | null;
  inLibrary: boolean | null;
  isLocal: boolean | null;
  totalPages: number | null;
}

export interface DBNovelInfo extends NovelInfo {
  totalChapters: number;
  chaptersDownloaded: number;
  chaptersUnread: number;
  lastReadAt: string;
  lastUpdatedAt: string;
}

export interface LibraryNovelInfo extends DBNovelInfo {
  category: string;
  chaptersUnread: number;
  chaptersDownloaded: number;
}

export interface ChapterInfo {
  id: number;
  novelId: number;
  path: string;
  name: string;
  releaseTime?: string | null;
  readTime: string | null;
  bookmark: boolean | null;
  unread: boolean | null;
  isDownloaded: boolean | null;
  updatedTime: string | null;
  chapterNumber?: number | null;
  page: string | null;
  progress: number | null;
  position?: number | null;
}

export interface DownloadedChapter extends ChapterInfo {
  pluginId: string;
  novelName: string;
  novelPath: string;
  novelCover: string;
}

export interface History extends ChapterInfo {
  pluginId: string;
  novelName: string;
  novelPath: string;
  novelCover: string;
  readTime: string;
}

export interface Update extends ChapterInfo {
  updatedTime: string | null;
  pluginId: string;
  novelName: string;
  novelPath: string;
  novelCover: string | null;
}

export interface UpdateOverview {
  novelId: number;
  novelName: string;
  updateDate: string;
  updatesPerDay: number;
  novelCover: string;
}

export interface Category {
  id: number;
  name: string;
  sort: number | null;
}

export interface NovelCategory {
  novelId: number;
  categoryId: number;
}

export interface CCategory extends Category {
  novelsCount: number;
}

export interface LibraryStats {
  novelsCount?: number;
  chaptersCount?: number;
  chaptersRead?: number;
  chaptersUnread?: number;
  chaptersDownloaded?: number;
  sourcesCount?: number;
  genres?: Record<string, number>;
  status?: Record<string, number>;
}

export interface BackupNovel extends NovelInfo {
  chapters: ChapterInfo[];
}

export interface BackupCategory extends Category {
  novelIds: number[];
}

export interface Repository {
  id: number;
  url: string;
}

export * from './migration';
