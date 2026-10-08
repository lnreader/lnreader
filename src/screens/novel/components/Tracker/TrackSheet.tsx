import React, { useCallback, useState } from 'react';
import { ToastAndroid } from 'react-native';
import { Box } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import BottomSheet from '@components/BottomSheet/BottomSheet';
import { useTracker, useTrackedNovel } from '@hooks/persisted';
import { TrackerName, UserListStatus } from '@services/Trackers';
import { NovelInfo } from '@database/types';
import { TrackerMetadata } from '@hooks/persisted/useTracker';
import { getStatusLabel, getTrackerIcon } from './constants';
import { AddTrackingCard, TrackedItemCard } from './TrackerCards';
import TrackSearchDialog from './TrackSearchDialog';
import SetTrackStatusDialog from './SetTrackStatusDialog';
import SetTrackScoreDialog from './SetTrackScoreDialog';
import SetTrackChaptersDialog from './SetTrackChaptersDialog';

interface TrackSheetProps {
  visible: boolean;
  onDismiss: () => void;
  novel: NovelInfo;
}

const TrackSheet: React.FC<TrackSheetProps> = ({
  visible,
  onDismiss,
  novel,
}) => {
  const { getAuthenticatedTrackers } = useTracker();
  const {
    getTrackedNovel,
    trackNovelOn,
    untrackNovelFrom,
    updateTrackedNovel,
  } = useTrackedNovel(novel.id);

  const authenticatedTrackers = getAuthenticatedTrackers();

  const [activeTracker, setActiveTracker] = useState<TrackerMetadata | null>(
    null,
  );
  const [trackSearchDialog, setTrackSearchDialog] = useState(false);
  const [trackStatusDialog, setTrackStatusDialog] = useState(false);
  const [trackChaptersDialog, setTrackChaptersDialog] = useState(false);
  const [trackScoreDialog, setTrackScoreDialog] = useState(false);

  const closeBottomSheet = onDismiss;

  const handleSetSearchTrackDialog = useCallback(
    (tracker: TrackerMetadata) => {
      closeBottomSheet();
      setActiveTracker(tracker);
      setTrackSearchDialog(true);
    },
    [closeBottomSheet],
  );

  const handleSetStatusDialog = useCallback(
    (tracker: TrackerMetadata) => {
      setActiveTracker(tracker);
      closeBottomSheet();
      setTrackStatusDialog(true);
    },
    [closeBottomSheet],
  );

  const handleSetChaptersDialog = useCallback(
    (tracker: TrackerMetadata) => {
      setActiveTracker(tracker);
      closeBottomSheet();
      setTrackChaptersDialog(true);
    },
    [closeBottomSheet],
  );

  const handleSetScoreDialog = useCallback(
    (tracker: TrackerMetadata) => {
      setActiveTracker(tracker);
      closeBottomSheet();
      setTrackScoreDialog(true);
    },
    [closeBottomSheet],
  );

  const handleDismissSearchDialog = useCallback(() => {
    setTrackSearchDialog(false);
    setActiveTracker(null);
  }, []);

  const handleDismissStatusDialog = useCallback(() => {
    setTrackStatusDialog(false);
    setActiveTracker(null);
  }, []);

  const handleDismissChaptersDialog = useCallback(() => {
    setTrackChaptersDialog(false);
    setActiveTracker(null);
  }, []);

  const handleDismissScoreDialog = useCallback(() => {
    setTrackScoreDialog(false);
    setActiveTracker(null);
  }, []);

  const updateTrackChapters = useCallback(
    (newChapters: string) => {
      if (!activeTracker) return;

      if (!newChapters) {
        ToastAndroid.show('Enter a valid number', ToastAndroid.SHORT);
        return;
      }

      const newProgress = Number(newChapters);
      if (isNaN(newProgress)) {
        ToastAndroid.show('Enter a valid number', ToastAndroid.SHORT);
        return;
      }

      updateTrackedNovel(activeTracker, { progress: newProgress });
    },
    [activeTracker, updateTrackedNovel],
  );

  const updateTrackStatus = useCallback(
    (newStatus: UserListStatus) => {
      if (!activeTracker) return;
      updateTrackedNovel(activeTracker, { status: newStatus });
    },
    [activeTracker, updateTrackedNovel],
  );

  const updateTrackScore = useCallback(
    (newScore: number) => {
      if (!activeTracker) return;
      updateTrackedNovel(activeTracker, { score: newScore });
    },
    [activeTracker, updateTrackedNovel],
  );

  const handleUntrack = useCallback(
    (trackerName: TrackerName) => {
      untrackNovelFrom(trackerName);
    },
    [untrackNovelFrom],
  );

  const activeTrackedNovel = activeTracker
    ? getTrackedNovel(activeTracker.name)
    : undefined;

  if (authenticatedTrackers.length === 0) {
    return null;
  }

  return (
    <>
      <BottomSheet visible={visible} onDismiss={onDismiss}>
        {authenticatedTrackers.map(tracker => {
          const trackerIcon = getTrackerIcon(tracker.name);
          const trackedNovel = getTrackedNovel(tracker.name);

          if (!trackerIcon) return null;

          return (
            <Box
              key={tracker.name}
              modifiers={[fillMaxWidth(), padding(0, 0, 0, 8)]}
            >
              {!trackedNovel ? (
                <AddTrackingCard
                  icon={trackerIcon}
                  onPress={() => handleSetSearchTrackDialog(tracker)}
                />
              ) : (
                <TrackedItemCard
                  onUntrack={() => handleUntrack(tracker.name)}
                  tracker={tracker}
                  icon={trackerIcon}
                  trackItem={trackedNovel}
                  onSetStatus={() => handleSetStatusDialog(tracker)}
                  onSetChapters={() => handleSetChaptersDialog(tracker)}
                  onSetScore={() => handleSetScoreDialog(tracker)}
                  getStatus={getStatusLabel}
                />
              )}
            </Box>
          );
        })}
      </BottomSheet>
      {activeTracker ? (
        <>
          {activeTrackedNovel ? (
            <>
              {trackStatusDialog ? (
                <SetTrackStatusDialog
                  tracker={activeTracker}
                  trackItem={activeTrackedNovel}
                  visible
                  onDismiss={handleDismissStatusDialog}
                  onUpdateStatus={updateTrackStatus}
                />
              ) : null}
              {trackChaptersDialog ? (
                <SetTrackChaptersDialog
                  tracker={activeTracker}
                  trackItem={activeTrackedNovel}
                  visible
                  onDismiss={handleDismissChaptersDialog}
                  onUpdateChapters={updateTrackChapters}
                />
              ) : null}
              {trackScoreDialog ? (
                <SetTrackScoreDialog
                  tracker={activeTracker}
                  trackItem={activeTrackedNovel}
                  visible
                  onDismiss={handleDismissScoreDialog}
                  onUpdateScore={updateTrackScore}
                />
              ) : null}
            </>
          ) : trackSearchDialog ? (
            <TrackSearchDialog
              tracker={activeTracker}
              onTrackNovel={trackNovelOn}
              visible
              onDismiss={handleDismissSearchDialog}
              novelName={novel.name}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default TrackSheet;
