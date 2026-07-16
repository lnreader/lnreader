import { ChapterSliceState } from './novelStore.types';

export const createInitialChapterSlice = (): ChapterSliceState => ({
  chapters: [],
  firstUnreadChapter: undefined,
  chapterTextCache: {},
  batchInformation: {
    batch: 0,
    total: 0,
  },
  scanlators: [],
});
