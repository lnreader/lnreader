import { useCallback, useMemo, useState } from 'react';
import {
  getDetailedUpdatesQuery,
  getUpdatedOverviewFromDb,
} from '@database/queries/ChapterQueries';

import { Update, UpdateOverview } from '@database/types';
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';
import dayjs from 'dayjs';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import { useLiveQuery } from '@database/manager/liveQuery';

export const SHOW_LAST_UPDATE_TIME = 'SHOW_LAST_UPDATE_TIME';
export const LAST_UPDATE_TIME = 'LAST_UPDATE_TIME';

const parseDetailedUpdates = (updates: Update[]) =>
  updates.map(update => ({
    ...update,
    chapterNumber: update.chapterNumber
      ? update.chapterNumber
      : parseChapterNumber(update.novelName, update.name),
  }));

export const useDetailedUpdates = (
  novelId: number,
  onlyDownloadedChapters = false,
  updateDate?: string,
  limit?: number,
) => {
  const query = useMemo(
    () =>
      getDetailedUpdatesQuery(
        novelId,
        onlyDownloadedChapters,
        updateDate,
        limit,
      ),
    [limit, novelId, onlyDownloadedChapters, updateDate],
  );
  const updates = useLiveQuery(query, [{ table: 'Chapter' }]);

  return useMemo(() => parseDetailedUpdates(updates), [updates]);
};

export const useLastUpdate = () => {
  const [showLastUpdateTime = true, setShowLastUpdateTime] = useMMKVBoolean(
    SHOW_LAST_UPDATE_TIME,
  );
  const [lastUpdateTime, setLastUpdateTime] = useMMKVString(LAST_UPDATE_TIME);
  return {
    lastUpdateTime,
    showLastUpdateTime,
    setLastUpdateTime,
    setShowLastUpdateTime,
  };
};

export const useUpdates = () => {
  const [updatesOverview, setUpdatesOverview] = useState<UpdateOverview[]>([]);

  const { lastUpdateTime, showLastUpdateTime, setLastUpdateTime } =
    useLastUpdate();
  const [error, setError] = useState('');

  const getUpdates = useCallback(async () => {
    try {
      const result = await getUpdatedOverviewFromDb();
      setUpdatesOverview(result);
      setError('');

      if (result.length) {
        if (
          !lastUpdateTime ||
          dayjs(lastUpdateTime).isBefore(dayjs(result[0].updateDate))
        ) {
          setLastUpdateTime(result[0].updateDate);
        }
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : String(updateError),
      );
    }
  }, [lastUpdateTime, setLastUpdateTime]);

  return useMemo(
    () => ({
      updatesOverview,
      getUpdates,
      lastUpdateTime,
      showLastUpdateTime,
      error,
    }),
    [updatesOverview, getUpdates, lastUpdateTime, showLastUpdateTime, error],
  );
};
