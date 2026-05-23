import React, { memo, useCallback, useMemo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  ChapterBookmarkButton,
  DownloadButton,
} from './Chapter/ChapterDownloadButtons';
import { ThemeColors } from '@theme/types';
import { ChapterInfo } from '@database/types';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getString } from '@strings/translations';
import dayjs from 'dayjs';

interface ChapterItemProps {
  chapter: ChapterInfo;
  isDownloading?: boolean;
  isBookmarked?: boolean;
  isSelected?: boolean;
  isLocal: boolean;
  isUpdateCard?: boolean;
  theme: ThemeColors;
  showChapterTitles: boolean;
  novelName: string;
  left?: ReactNode;
  onDeleteChapter: (chapter: ChapterInfo) => void;
  onDownloadChapter: (chapter: ChapterInfo) => void;
  onSelectPress: (chapter: ChapterInfo) => void;
  onSelectLongPress?: (chapter: ChapterInfo) => void;
}

const ChapterItem: React.FC<ChapterItemProps> = ({
  chapter,
  isDownloading,
  isBookmarked,
  isSelected,
  isLocal,
  isUpdateCard,
  theme,
  showChapterTitles,
  novelName,
  left,
  onDeleteChapter,
  onDownloadChapter,
  onSelectPress,
  onSelectLongPress,
}) => {
  const { id, name, unread, releaseTime, bookmark, chapterNumber, progress } =
    chapter;

  isBookmarked ??= bookmark ?? false;

  const handlePress = useCallback(
    () => onSelectPress(chapter),
    [onSelectPress, chapter],
  );
  const handleLongPress = useCallback(
    () => onSelectLongPress?.(chapter),
    [onSelectLongPress, chapter],
  );
  const handleDelete = useCallback(
    () => onDeleteChapter(chapter),
    [onDeleteChapter, chapter],
  );
  const handleDownload = useCallback(
    () => onDownloadChapter(chapter),
    [onDownloadChapter, chapter],
  );

  const selectedStyle = useMemo(
    () =>
      isSelected
        ? [styles.chapterCardContainer, { backgroundColor: theme.rippleColor }]
        : styles.chapterCardContainer,
    [isSelected, theme.rippleColor],
  );

  const titleColor = useMemo(
    () =>
      !unread ? theme.outline : bookmark ? theme.primary : theme.onSurface,
    [unread, bookmark, theme.outline, theme.primary, theme.onSurface],
  );

  const releaseColor = useMemo(
    () =>
      !unread
        ? theme.outline
        : bookmark
        ? theme.primary
        : theme.onSurfaceVariant,
    [unread, bookmark, theme.outline, theme.primary, theme.onSurfaceVariant],
  );

  const ripple = useMemo(
    () => ({ color: theme.rippleColor }),
    [theme.rippleColor],
  );

  const releaseTimeStyle = {
    color: theme.outline,
    marginStart: chapter.releaseTime ? 5 : 0,
  } as const;
  function parseTime(time?: string | Date | null) {
    if (!time) return undefined;
    const parsedTime = dayjs(time);
    return parsedTime.isValid() ? parsedTime.format('LL') : (time as string);
  }
  const parsedTime = parseTime(releaseTime);

  return (
    <View key={'chapterItem' + id}>
      <Pressable
        style={selectedStyle}
        onPress={handlePress}
        onLongPress={handleLongPress}
        android_ripple={ripple}
      >
        <View style={styles.row}>
          {left}
          {isBookmarked ? <ChapterBookmarkButton theme={theme} /> : null}
          <View style={styles.flex1}>
            {isUpdateCard ? (
              <Text
                style={[
                  styles.updateCardName,
                  { color: unread ? theme.onSurface : theme.outline },
                ]}
                numberOfLines={1}
              >
                {novelName}
              </Text>
            ) : null}
            <View style={styles.titleRow}>
              {unread ? (
                <MaterialCommunityIcons
                  name="circle"
                  color={theme.primary}
                  size={8}
                  style={styles.unreadIcon}
                />
              ) : null}

              <Text
                style={[
                  isUpdateCard ? styles.textSmall : styles.textNormal,
                  { color: titleColor },
                  styles.flex1,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {showChapterTitles
                  ? name
                  : getString('novelScreen.chapterChapnum', {
                      num: chapterNumber,
                    })}
              </Text>
            </View>
            <View style={styles.metaRow}>
              {parsedTime && !isUpdateCard ? (
                <Text
                  style={[{ color: releaseColor }, styles.mt4, styles.text]}
                  numberOfLines={1}
                >
                  {parsedTime}
                </Text>
              ) : null}
              {!isUpdateCard && progress && progress > 0 && chapter.unread ? (
                <Text
                  style={[styles.text, styles.mt4, releaseTimeStyle]}
                  numberOfLines={1}
                >
                  {chapter.releaseTime ? '•  ' : null}
                  {getString('novelScreen.progress', { progress })}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        {!isLocal ? (
          <DownloadButton
            isDownloading={isDownloading}
            isDownloaded={chapter.isDownloaded ?? false}
            theme={theme}
            deleteChapter={handleDelete}
            downloadChapter={handleDownload}
          />
        ) : null}
      </Pressable>
    </View>
  );
};

export default memo(ChapterItem);

const styles = StyleSheet.create({
  chapterCardContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  flex1: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  text: {
    fontSize: 12,
  },
  textNormal: {
    fontSize: 14,
  },
  textSmall: {
    fontSize: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadIcon: {
    marginEnd: 4,
  },
  updateCardName: {
    fontSize: 14,
  },
  mt4: {
    marginTop: 4,
  },
});
