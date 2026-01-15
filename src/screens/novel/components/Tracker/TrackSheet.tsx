import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { Portal, overlay } from 'react-native-paper';

import BottomSheet from '@components/BottomSheet/BottomSheet';
import { useTheme, useTracker, useTrackedNovel } from '@hooks/persisted';
import { TrackerName, UserListStatus } from '@services/Trackers';
import { NovelInfo } from '@database/types';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { TrackerMetadata } from '@hooks/persisted/useTracker';
import { getStatusLabel, getTrackerIcon } from './constants';
import { AddTrackingCard, TrackedItemCard } from './TrackerCards';
import TrackSearchDialog from './TrackSearchDialog';
import SetTrackStatusDialog from './SetTrackStatusDialog';
import SetTrackScoreDialog from './SetTrackScoreDialog';
import SetTrackChaptersDialog from './SetTrackChaptersDialog';

interface TrackSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModalMethods | null>;
  novel: NovelInfo;
}

const TrackSheet: React.FC<TrackSheetProps> = ({ bottomSheetRef, novel }) => {
  const theme = useTheme();
  const { getAuthenticatedTrackers } = useTracker();
  const {
    getTrackedNovel,
    isTrackedOn,
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

  const closeBottomSheet = useCallback(() => {
    bottomSheetRef.current?.close();
  }, [bottomSheetRef]);

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

  const snapPoints = useMemo(() => {
    const trackerCount = authenticatedTrackers.length;
    if (trackerCount === 0) return [130];

    // Base height + (number of trackers * card height)
    // Card height ~130px for add card, ~180px for tracked card
    const hasAnyTracked = authenticatedTrackers.some(t => isTrackedOn(t.name));
    const cardHeight = hasAnyTracked ? 180 : 130;
    const totalHeight = 50 + trackerCount * cardHeight;

    return [Math.min(totalHeight, 600)]; // Cap at 600px
  }, [authenticatedTrackers, isTrackedOn]);

  if (authenticatedTrackers.length === 0) {
    return null;
  }

  return (
    <>
      <BottomSheet bottomSheetRef={bottomSheetRef} snapPoints={snapPoints}>
        <ScrollView
          style={[
            styles.contentContainer,
            { backgroundColor: overlay(2, theme.surface) },
          ]}
        >
          {authenticatedTrackers.map(tracker => {
            const trackerIcon = getTrackerIcon(tracker.name);
            const trackedNovel = getTrackedNovel(tracker.name);

            if (!trackerIcon) return null;

            return (
              <View key={tracker.name} style={styles.trackerCardContainer}>
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
              </View>
            );
          })}
        </ScrollView>
      </BottomSheet>
      <Portal>
        {activeTracker && (
          <>
            {getTrackedNovel(activeTracker.name) ? (
              <>
                <SetTrackStatusDialog
                  tracker={activeTracker}
                  trackItem={getTrackedNovel(activeTracker.name)!}
                  visible={trackStatusDialog}
                  onDismiss={handleDismissStatusDialog}
                  onUpdateStatus={updateTrackStatus}
                />
                <SetTrackChaptersDialog
                  tracker={activeTracker}
                  trackItem={getTrackedNovel(activeTracker.name)!}
                  visible={trackChaptersDialog}
                  onDismiss={handleDismissChaptersDialog}
                  onUpdateChapters={updateTrackChapters}
                />
                <SetTrackScoreDialog
                  tracker={activeTracker}
                  trackItem={getTrackedNovel(activeTracker.name)!}
                  visible={trackScoreDialog}
                  onDismiss={handleDismissScoreDialog}
                  onUpdateScore={updateTrackScore}
                />
              </>
            ) : (
              <TrackSearchDialog
                tracker={activeTracker}
                onTrackNovel={trackNovelOn}
                visible={trackSearchDialog}
                onDismiss={handleDismissSearchDialog}
                novelName={novel.name}
              />
            )}
          </>
        )}
      </Portal>
    </>
  );
};

export default TrackSheet;

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  trackerCardContainer: {
    marginBottom: 8,
  },
});
