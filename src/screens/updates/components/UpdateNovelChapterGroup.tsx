import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Update, UpdateOverview } from '@database/types';
import { useDetailedUpdates } from '@hooks/persisted/useUpdates';
import NovelChapterGroup, {
  GroupedNovelChapter,
} from '@screens/novel/components/NovelChapterGroup';

interface UpdateNovelChapterGroupProps {
  chapterCountLabel: string;
  onDeleteChapter: (chapter: GroupedNovelChapter) => void;
  overview: UpdateOverview;
}

const ReactiveUpdateChapters = ({
  novelId,
  onChange,
  updateDate,
}: {
  novelId: number;
  onChange: (chapters: Update[]) => void;
  updateDate: string;
}) => {
  const chapters = useDetailedUpdates(novelId, false, updateDate);

  useEffect(() => onChange(chapters), [chapters, onChange]);

  return null;
};

const UpdateNovelChapterGroup: React.FC<UpdateNovelChapterGroupProps> = ({
  chapterCountLabel,
  onDeleteChapter,
  overview,
}) => {
  const [chapters, setChapters] = useState<Update[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const loadStatus = useRef<'idle' | 'loading' | 'loaded'>('idle');

  const novel = useMemo(
    () => ({
      id: overview.novelId,
      pluginId: overview.pluginId,
      name: overview.novelName,
      path: overview.novelPath,
      cover: overview.novelCover,
    }),
    [overview],
  );

  const loadChapters = useCallback(() => {
    if (loadStatus.current !== 'idle') {
      return;
    }

    loadStatus.current = 'loading';
    setIsLoading(true);
    setIsSubscribed(true);
  }, []);

  const updateChapters = useCallback((nextChapters: Update[]) => {
    setChapters(nextChapters);
    setIsLoading(false);
    loadStatus.current = 'loaded';
  }, []);

  useEffect(() => {
    let loadTimer: ReturnType<typeof setTimeout> | undefined;

    if (overview.updatesPerDay === 1) {
      loadTimer = setTimeout(() => void loadChapters(), 0);
    }

    return () => {
      if (loadTimer) {
        clearTimeout(loadTimer);
      }
    };
  }, [loadChapters, overview.updatesPerDay]);

  return (
    <>
      <NovelChapterGroup
        chapterCount={overview.updatesPerDay}
        chapterCountLabel={chapterCountLabel}
        chapters={chapters}
        isLoading={isLoading}
        novel={novel}
        onDeleteChapter={onDeleteChapter}
        onExpand={loadChapters}
      />
      {isSubscribed ? (
        <ReactiveUpdateChapters
          novelId={overview.novelId}
          onChange={updateChapters}
          updateDate={overview.updateDate}
        />
      ) : null}
    </>
  );
};

export default memo(UpdateNovelChapterGroup);
