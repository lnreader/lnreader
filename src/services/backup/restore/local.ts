import { CACHE_DIR_PATH, clearBackupCache } from '../cache';
import NativeZipArchive from '@modules/native-zip-archive';
import NativeFile from '@modules/native-file';
import { ZipBackupName } from '../types';
import { getString } from '@i18n/translations';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import { runRestore } from './run';

const printTime = (time?: number) => {
  if (!time) return '';
  if (time >= 1000) {
    return (time / 1000).toFixed(2) + 's';
  }
  return time.toFixed(2) + 'ms';
};

let startTime: number;
let lastTime: number | undefined;
const logRestoreBenchmark = (message: string) => {
  if (!__DEV__) {
    return;
  }
  const currentTime = performance.now();
  if (message === 'local:start') {
    lastTime = undefined;
    startTime = currentTime;
  }
  const diff = lastTime ? printTime(currentTime - lastTime) : undefined;
  lastTime = currentTime;
  // Benchmark output is consumed from the Metro client log.
  // eslint-disable-next-line no-console
  console.log(
    `[restore-benchmark] ${currentTime.toFixed(2)},${
      !diff ? '' : ' duration: ' + diff.padEnd(15, ' ')
    } ${message}`,
  );
  if (message === 'local:finalize:done') {
    // eslint-disable-next-line no-console
    console.log('Total time:', printTime(currentTime - startTime));
    lastTime = undefined;
  }
};

export const restoreBackup = async (
  { sourceUri }: { sourceUri: string },
  setMeta?: TaskProgressUpdater,
) => {
  logRestoreBenchmark('local:start');
  try {
    await runRestore(
      {
        kind: 'local',
        prepare: async report => {
          report?.('source', 0, getString('backupScreen.copyingBackup'), true);
          await clearBackupCache();
          const localPath = `${CACHE_DIR_PATH}-source.zip`;
          await NativeFile.copyFile(sourceUri, localPath);
          logRestoreBenchmark('local:copy:done');
          report?.('source', 1, getString('backupScreen.copyingBackup'), true);
          report?.(
            'extract',
            0,
            getString('backupScreen.extractingBackup'),
            true,
          );
          const outerArchiveStats = await NativeZipArchive.unzip(
            localPath,
            CACHE_DIR_PATH,
          );
          logRestoreBenchmark(
            `local:outer-unzip:done ${JSON.stringify(outerArchiveStats)}`,
          );
          report?.(
            'extract',
            1,
            getString('backupScreen.extractingBackup'),
            true,
          );
        },
        loadArchive: async (name, destination) => {
          const archivePath = `${CACHE_DIR_PATH}/${name}`;
          if (!(await NativeFile.exists(archivePath))) {
            throw new Error(getString('backupScreen.invalidBackupFolder'));
          }
          const archiveStats = await NativeZipArchive.unzip(
            archivePath,
            destination,
          );
          logRestoreBenchmark(
            `${
              name === ZipBackupName.DOWNLOAD
                ? 'local:legacy-archive'
                : 'local:selected-archive'
            }-unzip:done ${JSON.stringify(archiveStats)}`,
          );
        },
        benchmarkLog: logRestoreBenchmark,
      },
      setMeta,
    );
  } catch (error) {
    lastTime = undefined;
    setMeta?.(meta => ({ ...meta, isRunning: false }));
    throw error;
  }
};
