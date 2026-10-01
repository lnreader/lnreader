import React, { memo, useMemo } from 'react';

import { DownloadedChapter } from '@database/types';
import NovelChapterGroup, {
  GroupedNovelChapter,
} from '@screens/novel/components/NovelChapterGroup';

interface DownloadedNovelChapterGroupProps {
  chapterCountLabel: string;
  chapters: DownloadedChapter[];
  onDeleteChapter: (chapter: GroupedNovelChapter) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

const DownloadedNovelChapterGroup: React.FC<
  DownloadedNovelChapterGroupProps
> = ({
  chapterCountLabel,
  chapters,
  onDeleteChapter,
  expanded,
  onToggleExpanded,
}) => {
  const firstChapter = chapters[0];
  const novel = useMemo(
    () =>
      firstChapter
        ? {
            id: firstChapter.novelId,
            pluginId: firstChapter.pluginId,
            name: firstChapter.novelName,
            path: firstChapter.novelPath,
            cover: firstChapter.novelCover,
          }
        : null,
    [firstChapter],
  );

  if (!novel) {
    return null;
  }

  return (
    <NovelChapterGroup
      chapterCount={chapters.length}
      chapterCountLabel={chapterCountLabel}
      chapters={chapters}
      novel={novel}
      onDeleteChapter={onDeleteChapter}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
    />
  );
};

export default memo(DownloadedNovelChapterGroup);
