import type { DriveFile } from '@api/drive/types';
import type { NovelInfo } from '@database/types';
import type { NativeBackgroundTaskRecord } from '@modules/native-background-tasks';
import type {
  EpubExportChapter,
  EpubExportMetadata,
} from '@modules/nitro-epub';
import type { BackupOptions } from '@services/backup/options';

export type SelfHostData = {
  host: string;
  backupFolder: string;
  options?: BackupOptions;
};

export type DriveBackupData =
  | DriveFile
  | {
      backupFolder: DriveFile;
      options?: BackupOptions;
    };

export type MigrationNovelPreference = 'current' | 'destination';

export type MigrationNovelOptions = {
  cover: MigrationNovelPreference;
  metadata: MigrationNovelPreference;
  redownloadChapters: boolean;
};

export type MigrateNovelData = {
  pluginId: string;
  fromNovel: NovelInfo;
  toNovelPath: string;
  /**
   * Optional for compatibility with migration tasks queued before review
   * options were introduced.
   */
  options?: MigrationNovelOptions;
};

export type EpubImportFile = {
  filename: string;
  uri: string;
};

export type EpubExportData = {
  novelName: string;
  metadata: EpubExportMetadata;
  chapters: EpubExportChapter[];
  destinationUri: string;
  fileName: string;
};

export type ChapterDownload = {
  chapterId: number;
  chapterName: string;
};

export type BackgroundTask =
  | { name: 'IMPORT_EPUB'; data: { files: EpubImportFile[] } }
  | { name: 'EXPORT_EPUB'; data: EpubExportData }
  | {
      name: 'UPDATE_LIBRARY';
      data?: { categoryId?: number; categoryName?: string };
    }
  | { name: 'DRIVE_BACKUP'; data: DriveBackupData }
  | { name: 'DRIVE_RESTORE'; data: DriveFile }
  | { name: 'SELF_HOST_BACKUP'; data: SelfHostData }
  | { name: 'SELF_HOST_RESTORE'; data: SelfHostData }
  | {
      name: 'LOCAL_BACKUP';
      data: {
        destinationUri: string;
        options?: BackupOptions;
        automatic?: boolean;
      };
    }
  | { name: 'LOCAL_RESTORE'; data: { sourceUri: string } }
  | { name: 'MIGRATE_NOVEL'; data: MigrateNovelData }
  | DownloadChapterTask;

export type DownloadChapterTask = {
  name: 'DOWNLOAD_CHAPTER';
  data: {
    novelName: string;
    /**
     * Optional for compatibility with download tasks queued before
     * per-plugin execution lanes were introduced.
     */
    pluginId?: string;
    /**
     * Optional for compatibility with download tasks persisted before the
     * per-novel queue identity was introduced.
     */
    novelId?: number;
    chapters: ChapterDownload[];
  };
};

export type BackgroundTaskMetadata = {
  name: string;
  isRunning: boolean;
  progress: number | undefined;
  progressText: string | undefined;
  completionText?: string;
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
