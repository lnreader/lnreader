import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChapterInfo } from '@database/types';

export const useChapterSelection = (
  chapters: ChapterInfo[],
  getAllChapterIds: () => Promise<number[]>,
) => {
  const [selectedIds, setSelectedIdsState] = useState<number[]>([]);
  const selectionVersion = useRef(0);
  const setSelectedIds = useCallback<Dispatch<SetStateAction<number[]>>>(
    value => {
      selectionVersion.current += 1;
      setSelectedIdsState(value);
    },
    [],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedChapters = useMemo(
    () => chapters.filter(chapter => selectedIdSet.has(chapter.id)),
    [chapters, selectedIdSet],
  );
  const clearSelection = useCallback(
    () => setSelectedIds([]),
    [setSelectedIds],
  );
  const selectAll = useCallback(async () => {
    const requestVersion = ++selectionVersion.current;
    const chapterIds = await getAllChapterIds();
    if (selectionVersion.current === requestVersion) {
      setSelectedIdsState(chapterIds);
    }
  }, [getAllChapterIds]);

  return {
    selectedIds,
    selectedChapters,
    setSelectedIds,
    clearSelection,
    selectAll,
  };
};
