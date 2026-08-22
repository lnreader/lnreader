import { useCallback, useMemo } from 'react';

import {
  deleteChapters,
  getNovelDownloadedChapters,
} from '@database/queries/ChapterQueries';
import { deleteNovelHistory } from '@database/queries/HistoryQueries';
import { removeNovelsFromLibrary } from '@database/queries/NovelQueries';
import { useDownload } from '@hooks/persisted';
import { History } from '@database/types';
import { backgroundTasks } from '@services/backgroundTasks';

/**
 * Bulk-purge helper for the History screen (#1874): for every selected
 * history entry, cancel any queued chapter downloads, wipe downloaded
 * files, clear that novel's read history, and remove it from Library when
 * it belongs there. Non-library entries are handled gracefully (history +
 * files only).
 */
export const useHistoryPurge = () => {
  const { downloadQueue } = useDownload();

  const downloadingNovelIds = useMemo(
    () =>
      new Set(
        downloadQueue.flatMap(item =>
          item.task.data.novelId === undefined ? [] : [item.task.data.novelId],
        ),
      ),
    [downloadQueue],
  );

  const purgeNovels = useCallback(
    async (entries: History[]) => {
      const uniqueEntries = new Map<number, History>();
      for (const entry of entries) {
        if (!uniqueEntries.has(entry.novelId)) {
          uniqueEntries.set(entry.novelId, entry);
        }
      }

      // Cancel queued downloads touching the selection before deleting, so
      // a running queue can't recreate files we just wiped. The queue is
      // MMKV-backed; cancelling by type is the public API surface.
      const touchesSelection = [...uniqueEntries.values()].some(entry =>
        downloadingNovelIds.has(entry.novelId),
      );
      if (touchesSelection) {
        await backgroundTasks.cancelByType('DOWNLOAD_CHAPTER');
      }

      const libraryNovelIds: number[] = [];

      for (const entry of uniqueEntries.values()) {
        const downloaded = await getNovelDownloadedChapters(entry.novelId);
        if (downloaded.length) {
          await deleteChapters(
            entry.pluginId,
            entry.novelId,
            downloaded.map(chapter => chapter.id),
          );
        }
        await deleteNovelHistory(entry.novelId);
        if (entry.inLibrary) {
          libraryNovelIds.push(entry.novelId);
        }
      }

      if (libraryNovelIds.length) {
        await removeNovelsFromLibrary(libraryNovelIds);
      }

      return { purgedNovels: uniqueEntries.size } as const;
    },
    [downloadingNovelIds],
  );

  return { purgeNovels };
};
