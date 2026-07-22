import type { DriveFile } from '@api/drive/types';
import type { NovelInfo } from '@database/types';
import type { NativeBackgroundTaskRecord } from '@modules/native-background-tasks';

export type SelfHostData = {
  host: string;
  backupFolder: string;
};

export type MigrateNovelData = {
  pluginId: string;
  fromNovel: NovelInfo;
  toNovelPath: string;
};

export type EpubImportFile = {
  filename: string;
  uri: string;
};

export type ChapterDownload = {
  chapterId: number;
  chapterName: string;
};

export type BackgroundTask =
  | { name: 'IMPORT_EPUB'; data: { files: EpubImportFile[] } }
  | {
      name: 'UPDATE_LIBRARY';
      data?: { categoryId?: number; categoryName?: string };
    }
  | { name: 'DRIVE_BACKUP'; data: DriveFile }
  | { name: 'DRIVE_RESTORE'; data: DriveFile }
  | { name: 'SELF_HOST_BACKUP'; data: SelfHostData }
  | { name: 'SELF_HOST_RESTORE'; data: SelfHostData }
  | { name: 'LOCAL_BACKUP'; data: { destinationUri: string } }
  | { name: 'LOCAL_RESTORE'; data: { sourceUri: string } }
  | { name: 'MIGRATE_NOVEL'; data: MigrateNovelData }
  | DownloadChapterTask;

export type DownloadChapterTask = {
  name: 'DOWNLOAD_CHAPTER';
  data: { novelName: string; chapters: ChapterDownload[] };
};

export type BackgroundTaskMetadata = {
  name: string;
  isRunning: boolean;
  progress: number | undefined;
  progressText: string | undefined;
};

export type TaskProgressUpdater = (
  transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
) => void;

export type BackgroundTaskExecutionContext = {
  checkpoint?: string;
  updateCheckpoint: (checkpoint: string) => Promise<void>;
};

export type BackgroundTaskEnqueuer = (
  tasks: BackgroundTask | BackgroundTask[],
) => void;

export type QueuedBackgroundTask = {
  task: BackgroundTask;
  meta: BackgroundTaskMetadata;
  id: string;
  state?: NativeBackgroundTaskRecord['state'];
};

export type HeadlessBackgroundTaskData = {
  taskId: string;
  type: BackgroundTask['name'];
  payload: string;
  checkpoint?: string;
};
