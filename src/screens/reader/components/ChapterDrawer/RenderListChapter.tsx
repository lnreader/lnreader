import React from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  defaultMinSize,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppText } from '@components';
import { ChapterInfo } from '@database/types';
import { ThemeColors } from '@theme/types';
import { DateFormat, formatDate } from '@utils/dateFormat';

type Props = {
  item: ChapterInfo;
  theme: ThemeColors;
  chapterId: number;
  /** Takes the chapter so the caller can pass a stable handler. */
  onPress: (chapter: ChapterInfo) => void;
  dateFormat?: DateFormat;
  relativeTimestamps?: boolean;
};

/**
 * A component rather than a render function so that rows can bail out of
 * re-rendering: the chapter list is re-created whenever reading progress is
 * written, which happens continuously while a chapter is open.
 */
const RenderListChapter = ({
  item,
  theme,
  onPress,
  chapterId,
  dateFormat = 'default',
  relativeTimestamps = true,
}: Props) => {
  const isCurrentChapter = item.id === chapterId;

  return (
    <Column
      verticalArrangement="center"
      modifiers={[
        fillMaxWidth(),
        padding(0, 2, 0, 2),
        defaultMinSize({ minHeight: 48 }),
        ...(isCurrentChapter ? [background(theme.secondaryContainer)] : []),
        clickable(() => onPress(item)),
        padding(12, 10, 12, 10),
      ]}
    >
      <AppText
        maxLines={1}
        variant="bodyMedium"
        color={
          isCurrentChapter
            ? theme.onSecondaryContainer
            : item.unread
            ? theme.onSurface
            : theme.outline
        }
        modifiers={[padding(0, 0, 0, 2)]}
      >
        {item.name}
      </AppText>
      {item.releaseTime ? (
        <AppText
          variant="bodySmall"
          color={
            isCurrentChapter
              ? theme.onSecondaryContainer
              : item.unread
              ? theme.onSurfaceVariant
              : theme.outline
          }
        >
          {formatDate(item.releaseTime, dateFormat, relativeTimestamps)}
        </AppText>
      ) : null}
    </Column>
  );
};

export default React.memo(RenderListChapter);
