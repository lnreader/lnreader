import React, { memo, useCallback, ReactNode } from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  combinedClickable,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import {
  ChapterBookmarkButton,
  DownloadButton,
} from './Chapter/ChapterDownloadButtons';
import { ThemeColors } from '@theme/types';
import { ChapterInfo } from '@database/types';
import { AppText } from '@components';
import { getString } from '@i18n/translations';
import { DateFormat, formatDate } from '@utils/dateFormat';

interface ChapterItemProps {
  chapter: ChapterInfo;
  isDownloading?: boolean;
  isBookmarked?: boolean;
  isSelected?: boolean;
  isLocal: boolean;
  variant?: 'default' | 'grouped';
  theme: ThemeColors;
  showChapterTitles: boolean;
  novelName: string;
  left?: ReactNode;
  onDeleteChapter: (chapter: ChapterInfo) => void;
  onDownloadChapter: (chapter: ChapterInfo) => void;
  onSelectPress: (chapter: ChapterInfo) => void;
  onSelectLongPress?: (chapter: ChapterInfo) => void;
  dateFormat?: DateFormat;
  relativeTimestamps?: boolean;
}

const ChapterItem: React.FC<ChapterItemProps> = ({
  chapter,
  isDownloading,
  isBookmarked,
  isSelected,
  isLocal,
  variant = 'default',
  theme,
  showChapterTitles,
  novelName,
  left,
  onDeleteChapter,
  onDownloadChapter,
  onSelectPress,
  onSelectLongPress,
  dateFormat = 'default',
  relativeTimestamps = true,
}) => {
  const { name, unread, releaseTime, bookmark, chapterNumber, progress } =
    chapter;
  const isGrouped = variant === 'grouped';

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

  const titleColor = !unread
    ? theme.outline
    : bookmark
    ? theme.primary
    : theme.onSurface;

  const releaseColor = !unread
    ? theme.outline
    : bookmark
    ? theme.primary
    : theme.onSurfaceVariant;

  function parseTime(time?: string | Date | null) {
    if (!time) return undefined;
    return formatDate(time, dateFormat, relativeTimestamps);
  }
  const parsedTime = parseTime(releaseTime);

  const meta = isGrouped
    ? []
    : [
        parsedTime,
        chapter.scanlator,
        progress && progress > 0 && unread
          ? getString('novelScreen.progress', { progress })
          : undefined,
      ].filter(Boolean);

  return (
    <Row
      verticalAlignment="center"
      modifiers={[
        fillMaxWidth(),
        height(64),
        ...(isSelected
          ? [background(theme.rippleColor ?? theme.secondaryContainer)]
          : []),
        combinedClickable({
          onClick: handlePress,
          onLongClick: handleLongPress,
        }),
        padding(16, 8, 16, 8),
      ]}
    >
      {left}
      {isBookmarked ? <ChapterBookmarkButton theme={theme} /> : null}
      <Column modifiers={[weight(1)]}>
        {isGrouped ? (
          <AppText
            variant="bodyMedium"
            color={unread ? theme.onSurface : theme.outline}
            maxLines={1}
          >
            {novelName}
          </AppText>
        ) : null}
        <Row verticalAlignment="center">
          {unread ? (
            <Box modifiers={[padding(0, 0, 4, 0)]}>
              <Box
                modifiers={[
                  size(8, 8),
                  clip(Shapes.Circle),
                  background(theme.primary),
                ]}
              />
            </Box>
          ) : null}
          <AppText
            variant={isGrouped ? 'bodySmall' : 'bodyMedium'}
            color={titleColor}
            maxLines={1}
            modifiers={[weight(1)]}
          >
            {showChapterTitles
              ? name
              : getString('novelScreen.chapterChapnum', {
                  num: chapterNumber,
                })}
          </AppText>
        </Row>
        {meta.length ? (
          <AppText
            variant="bodySmall"
            color={releaseColor}
            maxLines={1}
            modifiers={[padding(0, 4, 0, 0)]}
          >
            {meta.join(' •  ')}
          </AppText>
        ) : null}
      </Column>
      {!isLocal ? (
        <DownloadButton
          isDownloading={isDownloading}
          isDownloaded={chapter.isDownloaded ?? false}
          theme={theme}
          deleteChapter={handleDelete}
          downloadChapter={handleDownload}
        />
      ) : null}
    </Row>
  );
};

export default memo(ChapterItem);
