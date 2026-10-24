import {
  _restoreNovelAndChapters,
  _restoreNovelsAndChapters,
  recordRestoreFallback,
  type RestoreNovelMetrics,
  type RestoreNovelOptions,
  type RestoreNovelProgress,
} from '@database/queries/NovelRestoreQueries';
import type { BackupNovel, RestoredNovelMapping } from '@database/types';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import { NOVEL_STORAGE, ROOT_STORAGE } from '@utils/Storages';
import type { RestoreProgressReporter } from './progress';
import { BackupEntryName, type ResolvedBackupManifest } from '../types';
import {
  NovelFileValidationError,
  decodeAndValidateNovelFile,
} from './validation';

const RESTORE_NOVEL_BATCH_SIZE = 100;
const BACKUP_FILE_CONCURRENCY = 8;
const APP_STORAGE_URI = 'file://' + ROOT_STORAGE;

type BackupNovelFileDescriptor = {
  name: string;
  path: string;
};

type RestoreBenchmarkLogger = (message: string) => void;

type RestoreNovelTelemetry = {
  database: RestoreNovelMetrics;
  collectDatabaseMetrics: boolean;
  uniqueInputChapterCount: number;
};

export type NovelRestoreSummary = {
  novelCount: number;
  failedNovelCount: number;
  failedSectionCount: number;
  pluginIds: string[];
  novelMappings: RestoredNovelMapping[];
  novelIdMap: Map<number, number>;
};

const restoreNovelsWithTelemetry = async (
  cacheDirPath: string,
  manifest: ResolvedBackupManifest,
  restoreRunId: string,
  progressReporter: RestoreProgressReporter | undefined,
  benchmarkLog: RestoreBenchmarkLogger | undefined,
  telemetry: RestoreNovelTelemetry,
): Promise<NovelRestoreSummary> => {
  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;
  const coversDirPath = cacheDirPath + '/' + BackupEntryName.COVERS;
  const summary: NovelRestoreSummary = {
    novelCount: 0,
    failedNovelCount: 0,
    failedSectionCount: 0,
    pluginIds: [],
    novelMappings: [],
    novelIdMap: new Map<number, number>(),
  };

  benchmarkLog?.('restoreData:novels:validation:start');
  progressReporter?.(
    'novels',
    0,
    getString('backupScreen.validatingNovels'),
    true,
  );
  if (!(await NativeFile.exists(novelDirPath))) {
    summary.failedSectionCount++;
    progressReporter?.(
      'novels',
      1,
      getString('backupScreen.restoringNovels'),
      true,
    );
    return summary;
  }

  let items: BackupNovelFileDescriptor[];
  try {
    items = (await NativeFile.readDir(novelDirPath))
      .filter(item => !item.isDirectory)
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      )
      .map(item => ({ name: item.name, path: item.path }));
  } catch {
    summary.failedSectionCount++;
    progressReporter?.(
      'novels',
      1,
      getString('backupScreen.restoringNovels'),
      true,
    );
    return summary;
  }

  const seenNovelIds = new Set<number>();
  const seenNovelIdentities = new Set<string>();
  const seenChapterIdentities = new Set<string>();
  const pluginIds = new Set<string>();
  const pendingNovels: BackupNovel[] = [];
  let filesProcessed = 0;
  let inputRecordCount = 0;
  let persistedNovelCount = 0;
  const totalNovelCount =
    manifest.formatVersion === 3 ||
    (manifest.formatVersion === 2 && manifest.novelDataFormat === 2)
      ? manifest.novelCount
      : items.length;
  let completedFileWork = 0;
  let pendingFileWork = 0;
  let activeFileWork = 0;
  let activeWorkFraction = 0;
  let activeDatabaseStage: RestoreNovelProgress['stage'] | undefined;
  let progressInterruptionLatched = false;
  let progressInterruption: unknown;
  let readMs = 0;
  let parseMs = 0;
  let databaseMs = 0;
  let coverProcessingMs = 0;
  let coverCandidates = 0;
  let coverFilesFound = 0;
  let coverFilesMissing = 0;
  let coverFilesCopied = 0;
  let coverProcessingFailures = 0;

  const getNovelCountText = () =>
    getString('backupScreen.restoringNovelsProgress', {
      current: persistedNovelCount,
      total: totalNovelCount ?? inputRecordCount,
    });
  const getNovelPhaseFraction = () => {
    if (items.length === 0) {
      return 1;
    }
    return (
      (0.25 * filesProcessed +
        0.75 * (completedFileWork + activeFileWork * activeWorkFraction)) /
      items.length
    );
  };
  const publishNovelProgress = (force = false) => {
    if (progressInterruptionLatched) {
      return;
    }
    try {
      progressReporter?.(
        'novels',
        getNovelPhaseFraction(),
        getNovelCountText(),
        force,
      );
    } catch (error) {
      if (!progressInterruptionLatched) {
        progressInterruptionLatched = true;
        progressInterruption = error;
      }
      throw error;
    }
  };
  const processFile = async (item: BackupNovelFileDescriptor) => {
    const readStartedAt = performance.now();
    let fileContent: string | undefined;
    try {
      fileContent = await NativeFile.readFile(item.path);
    } catch {
      summary.failedNovelCount++;
    } finally {
      readMs += performance.now() - readStartedAt;
    }

    if (fileContent === undefined) {
      inputRecordCount++;
      completedFileWork++;
    } else {
      const parseStartedAt = performance.now();
      try {
        const novels = decodeAndValidateNovelFile(
          fileContent,
          manifest,
          seenNovelIds,
          seenNovelIdentities,
          seenChapterIdentities,
        );
        inputRecordCount += novels.length;
        if (novels.length === 0) {
          completedFileWork++;
        } else {
          pendingFileWork++;
        }
        for (const novel of novels) {
          pluginIds.add(novel.pluginId);
          pendingNovels.push(novel);
        }
        if (telemetry.collectDatabaseMetrics) {
          telemetry.uniqueInputChapterCount = seenChapterIdentities.size;
        }
      } catch (error) {
        const rejectedRecordCount =
          error instanceof NovelFileValidationError ? error.recordCount : 1;
        summary.failedNovelCount += rejectedRecordCount;
        inputRecordCount += rejectedRecordCount;
        completedFileWork++;
      } finally {
        parseMs += performance.now() - parseStartedAt;
      }
    }

    filesProcessed++;
    publishNovelProgress();
  };

  publishNovelProgress(true);

  const restoreNovelBatch = async () => {
    if (pendingNovels.length === 0) {
      return;
    }
    const batch = pendingNovels.splice(0, pendingNovels.length);
    const fileWorkForBatch = pendingFileWork;
    pendingFileWork = 0;
    activeFileWork = fileWorkForBatch;
    activeWorkFraction = 0;
    activeDatabaseStage = undefined;

    const reportDatabaseCheckpoint = (
      progress: RestoreNovelProgress,
      fallbackIndex?: number,
    ) => {
      if (progressInterruptionLatched) {
        return;
      }
      try {
        const stageFraction =
          progress.total > 0
            ? Math.max(0, Math.min(1, progress.completed / progress.total))
            : 1;
        let databaseFraction: number;
        if (progress.stage === 'novels') {
          databaseFraction = 0.1 * stageFraction;
        } else if (progress.stage === 'chapters') {
          databaseFraction = 0.1 + 0.8 * stageFraction;
        } else {
          databaseFraction = 0.9 + 0.1 * stageFraction;
        }
        if (fallbackIndex !== undefined) {
          databaseFraction = (fallbackIndex + databaseFraction) / batch.length;
        }
        activeWorkFraction = Math.max(
          activeWorkFraction,
          0.8 * databaseFraction,
        );
        const stageChanged = activeDatabaseStage !== progress.stage;
        activeDatabaseStage = progress.stage;
        const stageCompleted =
          progress.total <= 0 || progress.completed >= progress.total;
        publishNovelProgress(stageChanged || stageCompleted);
      } catch (error) {
        if (!progressInterruptionLatched) {
          progressInterruptionLatched = true;
          progressInterruption = error;
        }
      }
    };
    const onBatchProgress = (progress: RestoreNovelProgress) =>
      reportDatabaseCheckpoint(progress);
    const restoreOptions: RestoreNovelOptions = {
      includeChapterMappings: manifest.sections.downloadedFiles,
      ...(manifest.sections.downloadedFiles ? { restoreRunId } : {}),
      ...(progressReporter ? { onProgress: onBatchProgress } : {}),
    };
    let restoredNovels: {
      backupNovel: BackupNovel;
      mapping: RestoredNovelMapping;
    }[] = [];
    const databaseStartedAt = performance.now();
    try {
      try {
        const mappings = telemetry.collectDatabaseMetrics
          ? await _restoreNovelsAndChapters(
              batch,
              restoreOptions,
              telemetry.database,
            )
          : await _restoreNovelsAndChapters(batch, restoreOptions);
        if (mappings.length !== batch.length) {
          throw new Error('Restore returned incomplete novel mappings');
        }
        restoredNovels = batch.map((backupNovel, index) => ({
          backupNovel,
          mapping: mappings[index],
        }));
        persistedNovelCount += batch.length;
      } catch (databaseError) {
        if (progressInterruptionLatched) {
          throw progressInterruption;
        }
        if (telemetry.collectDatabaseMetrics) {
          telemetry.database.novelBatchFallbacks++;
          recordRestoreFallback(telemetry.database, databaseError);
        }
        for (const [index, backupNovel] of batch.entries()) {
          if (telemetry.collectDatabaseMetrics) {
            telemetry.database.novelFallbackRowsAttempted++;
          }
          const fallbackOptions: RestoreNovelOptions = progressReporter
            ? {
                ...restoreOptions,
                onProgress: progress =>
                  reportDatabaseCheckpoint(progress, index),
              }
            : restoreOptions;
          let mapping: RestoredNovelMapping;
          try {
            mapping = telemetry.collectDatabaseMetrics
              ? await _restoreNovelAndChapters(
                  backupNovel,
                  fallbackOptions,
                  telemetry.database,
                )
              : await _restoreNovelAndChapters(backupNovel, fallbackOptions);
          } catch (fallbackError) {
            if (progressInterruptionLatched) {
              throw progressInterruption;
            }
            if (telemetry.collectDatabaseMetrics) {
              recordRestoreFallback(telemetry.database, fallbackError);
            }
            summary.failedNovelCount++;
            continue;
          }
          restoredNovels.push({ backupNovel, mapping });
          persistedNovelCount++;
          if (progressInterruptionLatched) {
            throw progressInterruption;
          }
          publishNovelProgress(true);
        }
      }
    } finally {
      databaseMs += performance.now() - databaseStartedAt;
    }

    if (progressInterruptionLatched) {
      throw progressInterruption;
    }
    activeWorkFraction = 0.8;
    activeDatabaseStage = undefined;
    publishNovelProgress(true);

    const shouldRestoreCover = (backupNovel: BackupNovel) =>
      !manifest.sections.downloadedFiles &&
      backupNovel.cover?.startsWith(APP_STORAGE_URI);
    const hasCoverWork = restoredNovels.some(({ backupNovel }) =>
      shouldRestoreCover(backupNovel),
    );
    const coverStartedAt = performance.now();
    if (hasCoverWork) {
      let attemptedCoverRecords = 0;
      for (
        let start = 0;
        start < restoredNovels.length;
        start += BACKUP_FILE_CONCURRENCY
      ) {
        const coverBatch = restoredNovels.slice(
          start,
          start + BACKUP_FILE_CONCURRENCY,
        );
        await Promise.all(
          coverBatch.map(async ({ backupNovel, mapping: novelMapping }) => {
            try {
              if (shouldRestoreCover(backupNovel)) {
                coverCandidates++;
                const coverBackupPath = coversDirPath + '/' + backupNovel.id;
                if (await NativeFile.exists(coverBackupPath)) {
                  coverFilesFound++;
                  const coverPath = `${NOVEL_STORAGE}/${backupNovel.pluginId}/${novelMapping.restoredNovelId}/cover.png`;
                  await NativeFile.mkdir(
                    coverPath.slice(0, Math.max(0, coverPath.lastIndexOf('/'))),
                  );
                  await NativeFile.copyFile(coverBackupPath, coverPath);
                  coverFilesCopied++;
                } else {
                  coverFilesMissing++;
                }
              }
            } catch {
              coverProcessingFailures++;
              summary.failedNovelCount++;
            }
          }),
        );
        attemptedCoverRecords += coverBatch.length;
        activeWorkFraction =
          0.8 + (0.2 * attemptedCoverRecords) / restoredNovels.length;
        publishNovelProgress(attemptedCoverRecords === restoredNovels.length);
      }
    }
    coverProcessingMs += performance.now() - coverStartedAt;
    completedFileWork += activeFileWork;
    activeFileWork = 0;
    activeWorkFraction = 0;
    publishNovelProgress(true);

    for (const { backupNovel, mapping: novelMapping } of restoredNovels) {
      summary.novelMappings.push(novelMapping);
      summary.novelIdMap.set(backupNovel.id, novelMapping.restoredNovelId);
      summary.novelCount++;
    }
  };

  let nextFileIndex = 0;
  while (nextFileIndex < items.length || pendingNovels.length > 0) {
    if (pendingNovels.length >= RESTORE_NOVEL_BATCH_SIZE) {
      const writePromise = restoreNovelBatch();
      if (nextFileIndex < items.length) {
        const filePromise = processFile(items[nextFileIndex++]);
        const [writeResult, fileResult] = await Promise.allSettled([
          writePromise,
          filePromise,
        ]);
        if (fileResult.status === 'rejected') {
          throw fileResult.reason;
        }
        if (writeResult.status === 'rejected') {
          throw writeResult.reason;
        }
      } else {
        await writePromise;
      }
      continue;
    }

    if (nextFileIndex < items.length) {
      await processFile(items[nextFileIndex++]);
      continue;
    }

    await restoreNovelBatch();
  }
  publishNovelProgress(true);

  benchmarkLog?.(`restoreData:novels:pipeline:done total=${filesProcessed}`);
  benchmarkLog?.(
    `restoreData:novels:done count=${summary.novelCount} failed=${
      summary.failedNovelCount
    } readMs=${readMs.toFixed(1)} parseMs=${parseMs.toFixed(
      1,
    )} databaseMs=${databaseMs.toFixed(
      1,
    )} coverProcessingMs=${coverProcessingMs.toFixed(
      1,
    )} coverCandidates=${coverCandidates} coverFilesFound=${coverFilesFound} coverFilesMissing=${coverFilesMissing} coverFilesCopied=${coverFilesCopied} coverProcessingFailures=${coverProcessingFailures}`,
  );

  summary.pluginIds = [...pluginIds];
  return summary;
};

export const restoreNovels = async (
  cacheDirPath: string,
  manifest: ResolvedBackupManifest,
  restoreRunId: string,
  progressReporter?: RestoreProgressReporter,
  benchmarkLog?: RestoreBenchmarkLogger,
): Promise<NovelRestoreSummary> => {
  const telemetry: RestoreNovelTelemetry = {
    collectDatabaseMetrics: __DEV__ && benchmarkLog !== undefined,
    database: {
      novelUpsertCalls: 0,
      novelUpsertRowsAttempted: 0,
      novelUpsertMs: 0,
      novelIdentityLookupCalls: 0,
      novelIdentityLookupRowsReturned: 0,
      novelIdentityLookupMs: 0,
      chapterWriteChunkCalls: 0,
      chapterWriteRowsAttempted: 0,
      chapterWriteMs: 0,
      chapterMappingRowsAttempted: 0,
      statsRefreshCalls: 0,
      statsRefreshNovels: 0,
      statsRefreshMs: 0,
      novelBatchFallbacks: 0,
      novelFallbackRowsAttempted: 0,
      chapterBatchFallbacks: 0,
      chapterFallbackRowsAttempted: 0,
      fallbackCauses: [],
    },
    uniqueInputChapterCount: 0,
  };
  try {
    return await restoreNovelsWithTelemetry(
      cacheDirPath,
      manifest,
      restoreRunId,
      progressReporter,
      benchmarkLog,
      telemetry,
    );
  } finally {
    if (telemetry.collectDatabaseMetrics) {
      benchmarkLog?.(
        `restoreData:database:summary ${JSON.stringify({
          uniqueInputChapterCount: telemetry.uniqueInputChapterCount,
          ...telemetry.database,
        })}`,
      );
    }
  }
};
