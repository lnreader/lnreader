import { act, renderHook } from '@testing-library/react-native';
import { ChapterInfo } from '@database/types';
import { useChapterSelection } from '../useChapterSelection';

const chapters = [
  { id: 1, name: 'Chapter 1' },
  { id: 2, name: 'Chapter 2' },
] as ChapterInfo[];

describe('useChapterSelection', () => {
  it('selects every chapter id returned by the database', async () => {
    const allChapterIds = Array.from({ length: 1001 }, (_, index) => index + 1);
    const getAllChapterIds = jest.fn().mockResolvedValue(allChapterIds);
    const { result } = renderHook(() =>
      useChapterSelection(chapters, getAllChapterIds),
    );

    await act(async () => {
      await result.current.selectAll();
    });

    expect(getAllChapterIds).toHaveBeenCalledTimes(1);
    expect(result.current.selectedIds).toEqual(allChapterIds);
    expect(result.current.selectedChapters).toEqual(chapters);
  });

  it('does not replace a newer manual selection with a stale select-all query', async () => {
    let resolveChapterIds!: (chapterIds: number[]) => void;
    const getAllChapterIds = jest.fn(
      () =>
        new Promise<number[]>(resolve => {
          resolveChapterIds = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useChapterSelection(chapters, getAllChapterIds),
    );

    await act(async () => {
      const selectAllRequest = result.current.selectAll();
      result.current.setSelectedIds([1]);
      resolveChapterIds([1, 2, 3]);
      await selectAllRequest;
    });

    expect(result.current.selectedIds).toEqual([1]);
  });
});
