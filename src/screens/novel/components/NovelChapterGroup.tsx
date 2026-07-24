import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, List } from 'react-native-paper';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { NovelCoverImage } from '@components';
import {
  ChapterInfo,
  DownloadedChapter,
  NovelInfo,
  Update,
} from '@database/types';
import { useDownload, useTheme } from '@hooks/persisted';
import { RootStackParamList } from '@navigators/types';
import { ThemeColors } from '@theme/types';
import ChapterItem from './ChapterItem';

export type GroupedNovelChapter = DownloadedChapter | Update;

interface NovelChapterGroupProps {
  chapterCount: number;
  chapterCountLabel: string;
  chapters: GroupedNovelChapter[];
  isLoading?: boolean;
  novel: NovelInfo;
  onDeleteChapter: (chapter: GroupedNovelChapter) => void;
  onExpand?: () => void;
}

const NovelChapterGroup: React.FC<NovelChapterGroupProps> = ({
  chapterCount,
  chapterCountLabel,
  chapters,
  isLoading = false,
  novel,
  onDeleteChapter,
  onExpand,
}) => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { downloadChapter, downloadingChapterIds } = useDownload();
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleAccordionPress = useCallback(() => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    if (nextExpanded) {
      onExpand?.();
    }
  }, [isExpanded, onExpand]);

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
      },
    });
  }, [navigate, novel]);

  const renderCover = useCallback(
    () => (
      <Pressable onPress={navigateToNovel} style={styles.alignSelf}>
        <NovelCoverImage
          uri={novel.cover}
          theme={theme}
          iconSize={20}
          style={styles.cover}
        />
      </Pressable>
    ),
    [navigateToNovel, novel.cover, styles.alignSelf, styles.cover, theme],
  );

  const coverElement = useMemo(
    () => <View style={styles.novelCover}>{renderCover()}</View>,
    [renderCover, styles.novelCover],
  );

  const renderChapter = useCallback(
    (chapter: GroupedNovelChapter) => (
      <ChapterItem
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
    ],
  );

  if (chapterCount > 1) {
    return (
      <List.Accordion
        title={novel.name}
        titleStyle={styles.title}
        left={renderCover}
        descriptionStyle={styles.description}
        theme={{ colors: theme }}
        style={[styles.container, styles.padding]}
        description={`${chapterCount} ${chapterCountLabel}`}
        expanded={isExpanded}
        onPress={handleAccordionPress}
      >
        <View style={styles.chapterList}>
          {isLoading ? (
            <ActivityIndicator
              color={theme.primary}
              style={styles.loadingIndicator}
            />
          ) : null}
          {chapters.map(chapter => (
            <React.Fragment key={`chapter-${chapter.id}`}>
              {renderChapter(chapter)}
            </React.Fragment>
          ))}
        </View>
      </List.Accordion>
    );
  }

  if (isLoading) {
    return (
      <ActivityIndicator
        color={theme.primary}
        style={styles.loadingIndicator}
      />
    );
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

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    alignSelf: { alignSelf: 'center' },
    chapterList: {
      marginStart: -40,
    },
    container: {
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cover: {
      borderRadius: 4,
      height: 40,
      width: 40,
    },
    description: { fontSize: 12 },
    loadingIndicator: {
      marginVertical: 16,
    },
    novelCover: {
      marginEnd: 16,
    },
    padding: {
      paddingHorizontal: 16,
      paddingVertical: 2,
    },
    title: { color: theme.onSurface, fontSize: 14 },
  });
}
