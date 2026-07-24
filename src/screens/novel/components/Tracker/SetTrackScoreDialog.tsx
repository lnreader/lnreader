import React, { useMemo, useState } from 'react';

import { Dialog } from '@components';
import { getString } from '@i18n/translations';
import {
  AniListScoreSelector,
  KitsuScoreSelector,
  MangaUpdatesScoreSelector,
  MyAnimeListScoreSelector,
} from './ScoreSelectors';
import { TrackScoreDialogProps } from './types';

type SetTrackScoreDialogContentProps = Omit<TrackScoreDialogProps, 'visible'>;

const SetTrackScoreDialogContent: React.FC<SetTrackScoreDialogContentProps> = ({
  tracker,
  trackItem,
  onDismiss,
  onUpdateScore,
}) => {
  const [selectedScore, setSelectedScore] = useState(trackItem.score);

  const handleSave = () => {
    onUpdateScore(selectedScore);
    onDismiss();
  };

  const ScoreSelector = useMemo(() => {
    switch (tracker.name) {
      case 'MyAnimeList':
        return (
          <MyAnimeListScoreSelector
            trackItem={{ ...trackItem, score: selectedScore }}
            onUpdateScore={setSelectedScore}
          />
        );
      case 'MangaUpdates':
        return (
          <MangaUpdatesScoreSelector
            trackItem={{ ...trackItem, score: selectedScore }}
            onUpdateScore={setSelectedScore}
          />
        );
      case 'Kitsu':
        return (
          <KitsuScoreSelector
            trackItem={{ ...trackItem, score: selectedScore }}
            onUpdateScore={setSelectedScore}
          />
        );
      case 'AniList':
      default:
        return (
          <AniListScoreSelector
            trackItem={{ ...trackItem, score: selectedScore }}
            scoreFormat={tracker.auth.meta.scoreFormat}
            onUpdateScore={setSelectedScore}
          />
        );
    }
  }, [tracker, trackItem, selectedScore]);

  return (
    <Dialog.Root visible onDismiss={onDismiss}>
      <Dialog.Title>Score</Dialog.Title>
      {tracker.name === 'Kitsu' || tracker.name === 'AniList' ? (
        <Dialog.ScrollArea>{ScoreSelector}</Dialog.ScrollArea>
      ) : (
        <Dialog.Content>{ScoreSelector}</Dialog.Content>
      )}
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action onPress={handleSave}>
          {getString('common.save')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

const SetTrackScoreDialog: React.FC<TrackScoreDialogProps> = ({
  visible,
  ...props
}) => (visible ? <SetTrackScoreDialogContent {...props} /> : null);

export default SetTrackScoreDialog;
