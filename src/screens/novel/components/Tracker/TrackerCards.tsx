import React, { useCallback } from 'react';
import { Box, Column, Image, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { useTheme } from '@hooks/persisted';
import { AppText, IconButtonV2 } from '@components';
import CloseIcon from '@expo/material-symbols/close.xml';
import {
  getAniListScoreFormatting,
  getKitsuScoreFormatting,
} from './constants';
import { AddTrackingCardProps, TrackedItemCardProps } from './types';

// Compose images take a bundled asset id; tracker icons are all `require`d.
const TrackerIcon = ({ icon }: { icon: AddTrackingCardProps['icon'] }) => (
  <Image
    source={icon as number}
    modifiers={[size(40, 40), clip(Shapes.RoundedCorner(8))]}
  />
);

export const AddTrackingCard: React.FC<AddTrackingCardProps> = ({
  onPress,
  icon,
}) => {
  const theme = useTheme();

  return (
    <Row
      verticalAlignment="center"
      modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}
    >
      <TrackerIcon icon={icon} />
      <Box
        contentAlignment="center"
        modifiers={[
          weight(1),
          padding(16, 0, 16, 0),
          clip(Shapes.RoundedCorner(4)),
          clickable(onPress),
          padding(0, 8, 0, 8),
        ]}
      >
        <AppText color={theme.primary}>Add Tracking</AppText>
      </Box>
    </Row>
  );
};

export const TrackedItemCard: React.FC<TrackedItemCardProps> = ({
  tracker,
  onUntrack,
  trackItem,
  onSetStatus,
  onSetChapters,
  onSetScore,
  getStatus,
  icon,
}) => {
  const theme = useTheme();
  const borderColor = theme.outlineVariant;

  const renderScore = useCallback(() => {
    if (trackItem.score === 0) {
      return '-';
    }

    if (tracker.name === 'AniList') {
      const formatting = getAniListScoreFormatting(
        tracker.auth.meta.scoreFormat,
        true,
      );
      return formatting.label(trackItem.score);
    }

    if (tracker.name === 'MangaUpdates') {
      /* Show decimal for MangaUpdates if it has decimal places */
      return Number.isInteger(trackItem.score)
        ? trackItem.score.toString()
        : trackItem.score.toFixed(1);
    }

    if (tracker.name === 'Kitsu') {
      return getKitsuScoreFormatting().label(trackItem.score);
    }

    return trackItem.score;
  }, [tracker, trackItem.score]);

  const renderChapters = useCallback(() => {
    const total = trackItem.totalChapters ? trackItem.totalChapters : '-';
    return `${trackItem.progress}/${total}`;
  }, [trackItem.progress, trackItem.totalChapters]);

  const cell = (text: string | number | undefined, onPress: () => void) => (
    <Box
      contentAlignment="center"
      modifiers={[weight(1), height(50), clickable(onPress)]}
    >
      <AppText color={theme.onSurfaceVariant}>{text}</AppText>
    </Box>
  );
  const divider = (
    <Box modifiers={[width(1), height(50), background(borderColor)]} />
  );

  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        padding(8, 8, 8, 8),
        clip(Shapes.RoundedCorner(8)),
        background(theme.surface),
      ]}
    >
      <Row
        verticalAlignment="center"
        modifiers={[fillMaxWidth(), padding(4, 4, 4, 4)]}
      >
        <TrackerIcon icon={icon} />
        <AppText
          color={theme.onSurfaceVariant}
          maxLines={2}
          modifiers={[weight(1), padding(8, 0, 0, 0)]}
        >
          {trackItem.title}
        </AppText>
        <IconButtonV2
          name={CloseIcon}
          color={theme.onSurfaceVariant}
          size={21}
          onPress={onUntrack}
          theme={theme}
        />
      </Row>
      <Box modifiers={[fillMaxWidth(), height(1), background(borderColor)]} />
      <Row modifiers={[fillMaxWidth()]}>
        {cell(getStatus(trackItem.status), onSetStatus)}
        {divider}
        {cell(renderChapters(), onSetChapters)}
        {divider}
        {cell(renderScore(), onSetScore)}
      </Row>
    </Column>
  );
};
