import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Update, UpdateOverview } from '@database/types';
import { fetchDetailedUpdates } from '@hooks/persisted/useUpdates';
import NovelChapterGroup, {
  GroupedNovelChapter,
} from '@screens/novel/components/NovelChapterGroup';
import { getErrorMessage } from '@utils/error';
import { showToast } from '@utils/showToast';

interface UpdateNovelChapterGroupProps {
  chapterCountLabel: string;
  onDeleteChapter: (chapter: GroupedNovelChapter) => void;
  overview: UpdateOverview;
}

const UpdateNovelChapterGroup: React.FC<UpdateNovelChapterGroupProps> = ({
  chapterCountLabel,
  onDeleteChapter,
  overview,
}) => {
  const [chapters, setChapters] = useState<Update[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadStatus = useRef<'idle' | 'loading' | 'loaded'>('idle');
  const latestRequestId = useRef(0);

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

  const loadChapters = useCallback(async () => {
    if (loadStatus.current !== 'idle') {
      return;
    }

    loadStatus.current = 'loading';
    setIsLoading(true);
    const requestId = ++latestRequestId.current;

    try {
      const result = await fetchDetailedUpdates(
        overview.novelId,
        false,
        overview.updateDate,
      );

      if (requestId === latestRequestId.current) {
        setChapters(result);
        loadStatus.current = 'loaded';
      }
    } catch (error) {
      if (requestId === latestRequestId.current) {
        loadStatus.current = 'idle';
        showToast(getErrorMessage(error));
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [overview.novelId, overview.updateDate]);

  useEffect(() => {
    let loadTimer: ReturnType<typeof setTimeout> | undefined;

    if (overview.updatesPerDay === 1) {
      loadTimer = setTimeout(() => void loadChapters(), 0);
    }

    return () => {
      if (loadTimer) {
        clearTimeout(loadTimer);
      }
      latestRequestId.current += 1;
    };
  }, [loadChapters, overview.updatesPerDay]);

  return (
    <NovelChapterGroup
      chapterCount={overview.updatesPerDay}
      chapterCountLabel={chapterCountLabel}
      chapters={chapters}
      isLoading={isLoading}
      novel={novel}
      onDeleteChapter={onDeleteChapter}
      onExpand={loadChapters}
    />
  );
};

export default memo(UpdateNovelChapterGroup);
