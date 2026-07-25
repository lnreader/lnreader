import { useCallback, useMemo, useState } from 'react';
import { ChapterInfo } from '@database/types';

export const useChapterSelection = (chapters: ChapterInfo[]) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const selectedIdSet = useMemo(() => {
    if (selectedIds.length === 0) {
      return new Set();
    }
    return new Set(selectedIds);
  }, [selectedIds]);

  const selectedChapters = useMemo(() => {
    if (selectedIds.length === 0) {
      return [];
    }
    return chapters.filter(chapter => selectedIdSet.has(chapter.id));
  }, [chapters, selectedIdSet, selectedIds.length]);

  const clearSelection = useCallback(() => {
    setSelectedIds(current => (current.length === 0 ? current : []));
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(current => {
      const allIds = chapters.map(chapter => chapter.id);
      if (current.length === allIds.length &&
          current.every((id, idx) => allIds[idx] === id)) {
        return current;
      }
      return allIds;
    });
  }, [chapters]);

  return {
    selectedIds,
    selectedChapters,
    setSelectedIds,
    clearSelection,
    selectAll,
  };
};
