import { useCallback, useMemo, useState } from 'react';
import {
  getDetailedUpdatesFromDb,
  getUpdatedOverviewFromDb,
} from '@database/queries/ChapterQueries';

import { UpdateOverview } from '@database/types';
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';
import dayjs from 'dayjs';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import { useFocusEffect } from '@react-navigation/native';

export const SHOW_LAST_UPDATE_TIME = 'SHOW_LAST_UPDATE_TIME';
export const LAST_UPDATE_TIME = 'LAST_UPDATE_TIME';

export const fetchDetailedUpdates = async (
  novelId: number,
  onlyDownloadedChapters = false,
  updateDate?: string,
) => {
  const result = await getDetailedUpdatesFromDb(
    novelId,
    onlyDownloadedChapters,
    updateDate,
  );

  return result.map(update => {
    const parsedTime = dayjs(update.releaseTime);
    return {
      ...update,
      releaseTime: parsedTime.isValid()
        ? parsedTime.format('LL')
        : update.releaseTime,
      chapterNumber: update.chapterNumber
        ? update.chapterNumber
        : parseChapterNumber(update.novelName, update.name),
    };
  });
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

  useFocusEffect(
    useCallback(() => {
      //? Push updates to the end of the stack to avoid lag
      const timer = setTimeout(() => void getUpdates(), 0);

      return () => clearTimeout(timer);
    }, [getUpdates]),
  );

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
