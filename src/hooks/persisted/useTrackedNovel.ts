import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import { SearchResult, TrackerName, UserListEntry } from '@services/Trackers';
import { TrackerMetadata, getTracker } from './useTracker';
import { getErrorMessage } from '@utils/error';
import { getMMKVObject, setMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';
import { showToast } from '@utils/showToast';

export const TRACKED_NOVEL_PREFIX = 'TRACKED_NOVEL_PREFIX';
const TRACKED_NOVEL_MIGRATION = 'TRACKED_NOVEL_MIGRATION_V1';

type TrackedNovel = SearchResult & UserListEntry;

const getTrackerStorageKey = (
  novelId: number | 'NO_ID',
  trackerName: TrackerName,
) => {
  return `${TRACKED_NOVEL_PREFIX}_${novelId}_${trackerName}`;
};

const getOldStorageKey = (novelId: number | 'NO_ID') => {
  return `${TRACKED_NOVEL_PREFIX}_${novelId}`;
};

export const useTrackedNovel = (novelId: number | 'NO_ID') => {
  const [migrated, setMigrated] = useMMKVString(
    `${TRACKED_NOVEL_MIGRATION}_${novelId}`,
  );

  const [trackedNovels, setTrackedNovels] = useState<
    Partial<Record<TrackerName, TrackedNovel>>
  >({});

  /**
   * Loads all tracked novel data for this novelId across all trackers.
   * Performs one-time migration from old single-tracker format if needed.
   */
  useEffect(() => {
    if (novelId === 'NO_ID') {
      return;
    }

    if (migrated !== 'true') {
      const oldKey = getOldStorageKey(novelId);
      const oldData = getMMKVObject<TrackedNovel>(oldKey);

      if (oldData) {
        MMKVStorage.remove(oldKey);
      }

      setMigrated('true');
    }

    const loadedNovels: Partial<Record<TrackerName, TrackedNovel>> = {};
    const trackerNames: TrackerName[] = [
      'AniList',
      'MyAnimeList',
      'MangaUpdates',
      'Kitsu',
    ];

    trackerNames.forEach(trackerName => {
      const key = getTrackerStorageKey(novelId, trackerName);
      const data = getMMKVObject<TrackedNovel>(key);
      if (data) {
        loadedNovels[trackerName] = data;
      }
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrackedNovels(loadedNovels);
  }, [novelId, migrated, setMigrated]);

  const getTrackedNovel = useCallback(
    (trackerName: TrackerName): TrackedNovel | undefined => {
      return trackedNovels[trackerName];
    },
    [trackedNovels],
  );

  const isTrackedOn = useCallback(
    (trackerName: TrackerName): boolean => {
      return !!trackedNovels[trackerName];
    },
    [trackedNovels],
  );

  const getTrackedOn = useCallback((): TrackerName[] => {
    return Object.keys(trackedNovels) as TrackerName[];
  }, [trackedNovels]);

  const trackNovel = useCallback(
    (tracker: TrackerMetadata, novel: SearchResult) => {
      if (novelId === 'NO_ID') {
        return Promise.resolve();
      }

      return getTracker(tracker.name)
        .getUserListEntry(novel.id, tracker.auth)
        .then((data: UserListEntry) => {
          const trackedNovel = {
            ...novel,
            ...data,
          };

          const key = getTrackerStorageKey(novelId, tracker.name);
          setMMKVObject(key, trackedNovel);

          setTrackedNovels(prev => ({
            ...prev,
            [tracker.name]: trackedNovel,
          }));

          return trackedNovel;
        });
    },
    [novelId],
  );

  const untrackNovel = useCallback(
    (trackerName: TrackerName) => {
      if (novelId === 'NO_ID') {
        return;
      }

      const key = getTrackerStorageKey(novelId, trackerName);
      MMKVStorage.remove(key);

      setTrackedNovels(prev => {
        const newTracked = { ...prev };
        delete newTracked[trackerName];
        return newTracked;
      });
    },
    [novelId],
  );

  const updateTrackedNovel = useCallback(
    (tracker: TrackerMetadata, data: Partial<UserListEntry>) => {
      if (novelId === 'NO_ID') {
        return Promise.resolve();
      }

      const currentTrackedNovel = trackedNovels[tracker.name];
      if (!currentTrackedNovel) {
        return Promise.resolve();
      }

      return getTracker(tracker.name)
        .updateUserListEntry(currentTrackedNovel.id, data, tracker.auth)
        .then((res: UserListEntry) => {
          const updatedNovel = {
            ...currentTrackedNovel,
            progress: res.progress,
            score: res.score,
            status: res.status,
          };

          const key = getTrackerStorageKey(novelId, tracker.name);
          setMMKVObject(key, updatedNovel);

          setTrackedNovels(prev => ({
            ...prev,
            [tracker.name]: updatedNovel,
          }));

          return updatedNovel;
        });
    },
    [novelId, trackedNovels],
  );

  /**
   * Updates tracking information across all authenticated trackers
   * that are currently tracking this novel.
   * Updates are performed in parallel for better performance.
   */
  const updateAllTrackedNovels = useCallback(
    async (data: Partial<UserListEntry>) => {
      if (novelId === 'NO_ID') {
        return;
      }

      const trackersToUpdate = Object.keys(trackedNovels) as TrackerName[];

      if (trackersToUpdate.length === 0) {
        return;
      }

      const authenticatedTrackers =
        getMMKVObject<Partial<Record<TrackerName, any>>>('TRACKERS');

      const updatePromises = trackersToUpdate
        .filter(trackerName => authenticatedTrackers?.[trackerName])
        .map(async trackerName => {
          const currentTrackedNovel = trackedNovels[trackerName];
          const tracker = authenticatedTrackers![trackerName];

          if (!currentTrackedNovel || !tracker) {
            return;
          }

          try {
            const res = await getTracker(trackerName).updateUserListEntry(
              currentTrackedNovel.id,
              data,
              tracker.auth,
            );

            const updatedNovel = {
              ...currentTrackedNovel,
              progress: res.progress,
              score: res.score,
              status: res.status,
            };

            const key = getTrackerStorageKey(novelId, trackerName);
            setMMKVObject(key, updatedNovel);

            setTrackedNovels(prev => ({
              ...prev,
              [trackerName]: updatedNovel,
            }));
          } catch (error) {
            showToast(
              `Failed to update ${trackerName}: ${getErrorMessage(error)}`,
            );
          }
        });

      await Promise.all(updatePromises);
    },
    [novelId, trackedNovels],
  );

  const trackedNovel = useMemo(() => {
    const tracked = Object.values(trackedNovels)[0];
    return tracked;
  }, [trackedNovels]);

  const trackNovelCompat = useCallback(
    (tracker: TrackerMetadata, novel: SearchResult) => {
      return trackNovel(tracker, novel);
    },
    [trackNovel],
  );

  const untrackNovelCompat = useCallback(() => {
    const firstTracker = Object.keys(trackedNovels)[0] as TrackerName;
    if (firstTracker) {
      untrackNovel(firstTracker);
    }
  }, [trackedNovels, untrackNovel]);

  if (novelId === 'NO_ID') {
    return {
      trackedNovel: undefined,
      trackNovel: () => Promise.resolve(),
      untrackNovel: () => {},
      updateTrackedNovel: () => Promise.resolve(),
      trackedNovels: {},
      getTrackedNovel: () => undefined,
      isTrackedOn: () => false,
      getTrackedOn: () => [],
      trackNovelOn: () => Promise.resolve(),
      untrackNovelFrom: () => {},
      updateAllTrackedNovels: () => Promise.resolve(),
    };
  }

  return {
    trackedNovel,
    trackNovel: trackNovelCompat,
    untrackNovel: untrackNovelCompat,
    updateTrackedNovel,
    trackedNovels,
    getTrackedNovel,
    isTrackedOn,
    getTrackedOn,
    trackNovelOn: trackNovel,
    untrackNovelFrom: untrackNovel,
    updateAllTrackedNovels,
  };
};
