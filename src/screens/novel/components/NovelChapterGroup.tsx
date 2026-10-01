import React, { memo, useCallback, useMemo, useState } from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import {
  AppIcon,
  AppText,
  LoadingMoreIndicator,
  NovelCoverImage,
} from '@components';
import {
  ChapterInfo,
  DownloadedChapter,
  NovelInfo,
  Update,
} from '@database/types';
import { useAppSettings, useDownload, useTheme } from '@hooks/persisted';
import { RootStackParamList } from '@navigators/types';
import ChapterItem from './ChapterItem';
import KeyboardArrowDownIcon from '@expo/material-symbols/keyboard_arrow_down.xml';
import KeyboardArrowUpIcon from '@expo/material-symbols/keyboard_arrow_up.xml';

export type GroupedNovelChapter = DownloadedChapter | Update;

interface NovelChapterGroupProps {
  chapterCount: number;
  chapterCountLabel: string;
  chapters: GroupedNovelChapter[];
  isLoading?: boolean;
  novel: NovelInfo;
  onDeleteChapter: (chapter: GroupedNovelChapter) => void;
  onExpand?: () => void;
  /**
   * Controlled expansion. With `onToggleExpanded`, the chapters are not
   * rendered here: the parent list renders them as rows of its own so they
   * are virtualized instead of all living in one host.
   */
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

const NovelChapterGroup: React.FC<NovelChapterGroupProps> = ({
  chapterCount,
  chapterCountLabel,
  chapters,
  isLoading = false,
  novel,
  onDeleteChapter,
  onExpand,
  expanded,
  onToggleExpanded,
}) => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { downloadChapter, downloadingChapterIds } = useDownload();
  const theme = useTheme();
  const { dateFormat = 'default', relativeTimestamps = true } =
    useAppSettings();
  const [expandedState, setIsExpanded] = useState(false);
  const isExpanded = expanded ?? expandedState;

  const handleAccordionPress = useCallback(() => {
    if (onToggleExpanded) {
      onToggleExpanded();
      return;
    }
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    if (nextExpanded) {
      onExpand?.();
    }
  }, [isExpanded, onExpand, onToggleExpanded]);

  const handleDownloadChapter = useCallback(
    (chapter: ChapterInfo) => {
      if (isGroupedNovelChapter(chapter)) {
        downloadChapter(novel, chapter);
      }
    },
    [downloadChapter, novel],
  );

  const handleDeleteChapter = useCallback(
    (chapter: ChapterInfo) => {
      if (isGroupedNovelChapter(chapter)) {
        onDeleteChapter(chapter);
      }
    },
    [onDeleteChapter],
  );

  const navigateToChapter = useCallback(
    (chapter: ChapterInfo) => {
      if (!isGroupedNovelChapter(chapter)) {
        return;
      }

      navigate('ReaderStack', {
        screen: 'Chapter',
        params: { novel, chapter },
      });
    },
    [navigate, novel],
  );

  const navigateToNovel = useCallback(() => {
    navigate('ReaderStack', {
      screen: 'Novel',
      params: {
        pluginId: novel.pluginId,
        path: novel.path,
        cover: novel.cover,
        name: novel.name,
        inLibrary: novel.inLibrary,
      },
    });
  }, [navigate, novel]);

  const coverElement = useMemo(
    () => (
      <Box modifiers={[padding(0, 0, 16, 0), clickable(navigateToNovel)]}>
        <NovelCoverImage
          uri={novel.cover}
          width={40}
          height={40}
          corner={4}
          label={novel.name}
          theme={theme}
        />
      </Box>
    ),
    [navigateToNovel, novel.cover, novel.name, theme],
  );

  const renderChapter = useCallback(
    (chapter: GroupedNovelChapter) => (
      <ChapterItem
        key={`chapter-${chapter.id}`}
        isLocal={false}
        isDownloading={downloadingChapterIds.has(chapter.id)}
        variant="grouped"
        novelName={novel.name}
        chapter={chapter}
        theme={theme}
        showChapterTitles={false}
        onDownloadChapter={handleDownloadChapter}
        onDeleteChapter={handleDeleteChapter}
        onSelectPress={navigateToChapter}
        left={coverElement}
        dateFormat={dateFormat}
        relativeTimestamps={relativeTimestamps}
      />
    ),
    [
      coverElement,
      downloadingChapterIds,
      handleDeleteChapter,
      handleDownloadChapter,
      navigateToChapter,
      novel.name,
      theme,
      dateFormat,
      relativeTimestamps,
    ],
  );

  if (chapterCount > 1) {
    return (
      <Column modifiers={[fillMaxWidth()]}>
        <Row
          verticalAlignment="center"
          modifiers={[
            fillMaxWidth(),
            clickable(handleAccordionPress),
            padding(16, 10, 16, 10),
          ]}
        >
          {coverElement}
          <Column modifiers={[weight(1)]}>
            <AppText variant="bodyMedium" color={theme.onSurface} maxLines={1}>
              {novel.name}
            </AppText>
            <AppText
              variant="bodySmall"
              color={theme.onSurfaceVariant}
              maxLines={1}
            >
              {`${chapterCount} ${chapterCountLabel}`}
            </AppText>
          </Column>
          <AppIcon
            source={isExpanded ? KeyboardArrowUpIcon : KeyboardArrowDownIcon}
            tint={theme.onSurfaceVariant}
          />
        </Row>
        {isExpanded && !onToggleExpanded ? (
          <Column modifiers={[fillMaxWidth(), padding(24, 0, 0, 0)]}>
            {isLoading ? <LoadingMoreIndicator theme={theme} /> : null}
            {chapters.map(renderChapter)}
          </Column>
        ) : null}
      </Column>
    );
  }

  if (isLoading) {
    return <LoadingMoreIndicator theme={theme} />;
  }

  return chapters[0] ? renderChapter(chapters[0]) : null;
};

export default memo(NovelChapterGroup);

const isGroupedNovelChapter = (
  chapter: ChapterInfo,
): chapter is GroupedNovelChapter =>
  'pluginId' in chapter &&
  'novelName' in chapter &&
  'novelPath' in chapter &&
  'novelCover' in chapter;
