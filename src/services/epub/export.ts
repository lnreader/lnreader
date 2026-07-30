import { copyFile } from 'react-native-saf-x';

import NativeFile from '@modules/native-file';
import { epub } from '@modules/nitro-epub';

import { getString } from '@i18n/translations';
import type {
  EpubExportData,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';

const sanitizeEpubFileName = (fileName: string) => {
  const withoutExtension = fileName.trim().replace(/\.epub$/i, '');
  return (
    withoutExtension
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .replace(/[. ]+$/g, '')
      .trim() || 'novel'
  );
};

const PROGRESS_UPDATE_INTERVAL_MS = 250;

export const exportEpub = async (
  data: EpubExportData,
  updateProgress: TaskProgressUpdater,
) => {
  const { chapters, destinationUri, fileName, metadata } = data;
  const tempEpubPath = `${
    NativeFile.ExternalCachesDirectoryPath
  }/epub-export-${Date.now()}.epub`;
  let lastProgressUpdateAt = 0;

  try {
    updateProgress(meta => ({
      ...meta,
      isRunning: true,
      progress: 0,
      progressText: getString('novelScreen.epub.preparingExport'),
    }));

    const result = await epub.exportEpub(
      metadata,
      chapters,
      tempEpubPath,
      async (completedChapters, totalChapters, chapterTitle) => {
        const total = Math.max(1, Math.round(totalChapters));
        const completed = Math.min(
          total,
          Math.max(0, Math.round(completedChapters)),
        );
        const now = Date.now();
        if (
          completed < total &&
          now - lastProgressUpdateAt < PROGRESS_UPDATE_INTERVAL_MS
        ) {
          return;
        }
        lastProgressUpdateAt = now;

        updateProgress(meta => ({
          ...meta,
          progress: (completed / total) * 0.95,
          progressText: getString('novelScreen.epub.exportingChapter', {
            current: completed,
            total,
            chapter: chapterTitle,
          }),
        }));
      },
    );

    updateProgress(meta => ({
      ...meta,
      progress: 0.95,
      progressText: getString('novelScreen.epub.savingExport'),
    }));

    const epubFileName = `${sanitizeEpubFileName(fileName)}.epub`;
    await copyFile(
      `file://${result.outputPath}`,
      `${destinationUri}/${epubFileName}`,
      { replaceIfDestinationExists: true },
    );

    const completionText = getString('novelScreen.epub.exportSuccess', {
      chapters: result.chapterCount.toString(),
    });
    updateProgress(meta => ({
      ...meta,
      isRunning: false,
      progress: 1,
      progressText: completionText,
      completionText,
    }));
  } catch (error) {
    updateProgress(meta => ({
      ...meta,
      isRunning: false,
    }));
    throw error;
  } finally {
    try {
      if (await NativeFile.exists(tempEpubPath)) {
        await NativeFile.unlink(tempEpubPath);
      }
    } catch {
      // Export cleanup must not replace the original result or error.
    }
  }
};
