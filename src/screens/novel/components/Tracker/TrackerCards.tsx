import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from 'react-native-paper';

import { useTheme } from '@hooks/persisted';
import {
  getAniListScoreFormatting,
  getKitsuScoreFormatting,
} from './constants';
import { AddTrackingCardProps, TrackedItemCardProps } from './types';

export const AddTrackingCard: React.FC<AddTrackingCardProps> = ({
  onPress,
  icon,
}) => {
  const theme = useTheme();

  return (
    <View style={styles.addCardContainer}>
      <Image source={icon} style={styles.trackerIcon} fadeDuration={0} />
      <View style={styles.addCardPressableContainer}>
        <Pressable
          style={styles.rippleContainer}
          android_ripple={{
            color: theme.rippleColor,
            borderless: true,
          }}
          onPress={onPress}
        >
          <Text style={[{ color: theme.primary }, styles.addTrackingText]}>
            Add Tracking
          </Text>
        </Pressable>
      </View>
    </View>
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
  const borderColor = 'rgba(0, 0, 0, 0.12)';

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

  return (
    <View style={[{ backgroundColor: theme.surface }, styles.cardContainer]}>
      <View style={[styles.titleContainer, { borderBottomColor: borderColor }]}>
        <Image source={icon} style={styles.trackerIcon} fadeDuration={0} />
        <View style={styles.listItemContainer}>
          <Text
            style={[{ color: theme.onSurfaceVariant }, styles.listItem]}
            numberOfLines={2}
          >
            {trackItem.title}
          </Text>
          <IconButton
            icon="close"
            iconColor={theme.onSurfaceVariant}
            size={21}
            onPress={onUntrack}
          />
        </View>
      </View>
      <View style={styles.trackedItemRow}>
        <Pressable
          style={[{ borderRightColor: borderColor }, styles.listItemLeft]}
          android_ripple={{ color: theme.rippleColor }}
          onPress={onSetStatus}
        >
          <Text style={[{ color: theme.onSurfaceVariant }, styles.listItem]}>
            {getStatus(trackItem.status)}
          </Text>
        </Pressable>
        <Pressable
          style={styles.flex1}
          android_ripple={{ color: theme.rippleColor }}
          onPress={onSetChapters}
        >
          <Text style={[{ color: theme.onSurfaceVariant }, styles.listItem]}>
            {renderChapters()}
          </Text>
        </Pressable>
        <Pressable
          style={[{ borderLeftColor: borderColor }, styles.listItemRight]}
          android_ripple={{ color: theme.rippleColor }}
          onPress={onSetScore}
        >
          <Text style={[{ color: theme.onSurfaceVariant }, styles.listItem]}>
            {renderScore()}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  addCardContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    margin: 16,
  },
  addCardPressableContainer: {
    borderRadius: 4,
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  addTrackingText: {
    textAlignVertical: 'center',
  },
  cardContainer: {
    borderRadius: 8,
    margin: 8,
  },
  flex1: {
    flex: 1,
  },
  listItem: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  listItemContainer: {
    alignItems: 'center',
    borderTopRightRadius: 4,
    flex: 1,
    flexDirection: 'row',
  },
  listItemLeft: {
    borderBottomLeftRadius: 4,
    borderRightWidth: 1,
    flex: 1,
  },
  listItemRight: {
    borderBottomRightRadius: 4,
    borderLeftWidth: 1,
    flex: 1,
  },
  rippleContainer: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  titleContainer: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  trackedItemRow: {
    flexDirection: 'row',
    height: 50,
  },
  trackerIcon: {
    borderRadius: 8,
    height: 40,
    width: 40,
  },
});
