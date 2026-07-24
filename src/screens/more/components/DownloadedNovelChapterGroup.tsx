import React, { memo, useMemo } from 'react';

import { DownloadedChapter } from '@database/types';
import NovelChapterGroup, {
  GroupedNovelChapter,
} from '@screens/novel/components/NovelChapterGroup';

interface DownloadedNovelChapterGroupProps {
  chapterCountLabel: string;
  chapters: DownloadedChapter[];
  onDeleteChapter: (chapter: GroupedNovelChapter) => void;
}

const DownloadedNovelChapterGroup: React.FC<
  DownloadedNovelChapterGroupProps
> = ({ chapterCountLabel, chapters, onDeleteChapter }) => {
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
    />
  );
};

export default memo(DownloadedNovelChapterGroup);
