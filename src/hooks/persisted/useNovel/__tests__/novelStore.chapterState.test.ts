import { createInitialChapterSlice } from '../store/novelStore.chapterState';

describe('novelStore.chapterState', () => {
  it('creates the expected initial chapter slice state', () => {
    expect(createInitialChapterSlice()).toEqual({
      chapters: [],
      firstUnreadChapter: undefined,
      chapterTextCache: {},
      scanlators: [],
      batchInformation: {
        batch: 0,
        total: 0,
      },
    });
  });

  it('returns independent objects on each call', () => {
    const first = createInitialChapterSlice();
    const second = createInitialChapterSlice();

    expect(first).not.toBe(second);
    expect(first.batchInformation).not.toBe(second.batchInformation);
    expect(first.chapterTextCache).not.toBe(second.chapterTextCache);
  });
});
