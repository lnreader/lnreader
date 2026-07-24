import { useCallback, useMemo, useState } from 'react';
import { ChapterInfo } from '@database/types';

export const useChapterSelection = (chapters: ChapterInfo[]) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedChapters = useMemo(
    () => chapters.filter(chapter => selectedIdSet.has(chapter.id)),
    [chapters, selectedIdSet],
  );
  const clearSelection = useCallback(() => setSelectedIds([]), []);
  const selectAll = useCallback(
    () => setSelectedIds(chapters.map(chapter => chapter.id)),
    [chapters],
  );

  return {
    selectedIds,
    selectedChapters,
    setSelectedIds,
    clearSelection,
    selectAll,
  };
};
