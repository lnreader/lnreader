export interface SyncNovelEntry {
  pluginId: string;
  path: string;
  name: string;
  cover?: string | null;
  author?: string | null;
  status?: string | null;
  inLibrary: boolean;
  categoryNames: string[];
}

export interface SyncChapterEntry {
  novelPluginId: string;
  novelPath: string;
  chapterPath: string;
  name: string;
  chapterNumber?: number | null;
  unread: boolean;
  progress: number; // Integer percentage 0 to 100
  readTime: string | null; // ISO 8601 string
  bookmark: boolean;
  page?: string | null;
}

export interface SyncCategoryEntry {
  name: string;
}

export interface SyncDevicePayload {
  version: 1;
  deviceId: string;
  lastUpdated: number; // Unix epoch milliseconds
  novels: SyncNovelEntry[];
  chapters: SyncChapterEntry[];
  categories: SyncCategoryEntry[];
}

export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  OFFLINE = 'OFFLINE',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  ERROR = 'ERROR',
}

export const DRIVE_SYNC_DEVICE_ID = 'DRIVE_SYNC_DEVICE_ID';
export const DRIVE_SYNC_DIRTY = 'DRIVE_SYNC_DIRTY';
export const DRIVE_SYNC_DIRTY_TOKEN = 'DRIVE_SYNC_DIRTY_TOKEN';
export const DRIVE_SYNC_WATERMARKS = 'DRIVE_SYNC_WATERMARKS';
