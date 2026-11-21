import type { ChapterRow } from '@modules/nitro-chapter-list';
import type { ChapterInfo } from '@database/types';
import {
  buildChapterRow,
  type ChapterListSnapshot,
  planChapterListSync,
} from '../chapterListSync';

jest.mock('@i18n/translations', () => ({
  getString: (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));

jest.mock('@utils/dateFormat', () => ({
  createDateFormatter: () => (value: string) => `date(${value})`,
}));

const row = (id: number, title = `Chapter ${id}`): ChapterRow => ({
  id,
  title,
  subtitle: '',
  unread: true,
  bookmarked: false,
  downloaded: false,
});

const rows = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => row(from + i));

const snapshot = (
  list: ChapterRow[],
  total = 2500,
  key = 'novel-1',
): ChapterListSnapshot => ({ key, total, rows: list });

describe('planChapterListSync', () => {
  it('resets and writes the first batch on the first sync', () => {
    const first = rows(1, 3);
    expect(planChapterListSync(null, snapshot(first))).toEqual([
      { type: 'reset', total: 2500 },
      { type: 'setRows', start: 0, rows: first },
    ]);
  });

  it('appends a newly loaded batch with one setRows', () => {
    const prev = rows(1, 1000);
    const next = [...prev, ...rows(1001, 2000)];
    expect(planChapterListSync(snapshot(prev), snapshot(next))).toEqual([
      { type: 'setRows', start: 1000, rows: next.slice(1000) },
    ]);
  });

  it('does nothing when the same rows are synced again', () => {
    const list = rows(1, 10);
    expect(planChapterListSync(snapshot(list), snapshot([...list]))).toEqual(
      [],
    );
  });

  it('patches edited rows by id without touching the rest', () => {
    const prev = rows(1, 5);
    const next = [...prev];
    next[1] = { ...prev[1], unread: false };
    next[3] = { ...prev[3] }; // new object, same content
    expect(planChapterListSync(snapshot(prev), snapshot(next))).toEqual([
      { type: 'updateRows', rows: [next[1]] },
    ]);
  });

  it('patches and appends in one sync', () => {
    const prev = rows(1, 2);
    const edited = { ...prev[0], downloaded: true };
    const next = [edited, prev[1], row(3)];
    expect(planChapterListSync(snapshot(prev), snapshot(next))).toEqual([
      { type: 'updateRows', rows: [edited] },
      { type: 'setRows', start: 2, rows: [row(3)] },
    ]);
  });

  it.each([
    ['the list key changes', snapshot(rows(1, 3), 2500, 'novel-2')],
    ['the total changes', snapshot(rows(1, 3), 2600)],
    ['rows move', snapshot([row(2), row(1), row(3)])],
  ])('replaces the list when %s', (_, next) => {
    const ops = planChapterListSync(snapshot(rows(1, 3)), next);
    expect(ops[0]).toEqual({ type: 'reset', total: next.total });
    expect(ops[1]).toEqual({ type: 'setRows', start: 0, rows: next.rows });
  });

  it('keeps native rows when the same list is reloaded with fewer batches', () => {
    // The novel store's getChapters (run after downloads) goes back to batch 0.
    const prev = rows(1, 3000);
    const next = prev.slice(0, 1000).map(r => ({ ...r }));
    next[4] = { ...next[4], downloaded: true };

    expect(planChapterListSync(snapshot(prev), snapshot(next))).toEqual([
      { type: 'updateRows', rows: [next[4]] },
      { type: 'staleRows', start: 1000, end: 3000 },
    ]);
  });

  it('only resets when the replacement list has no loaded rows yet', () => {
    expect(
      planChapterListSync(snapshot(rows(1, 3)), snapshot([], 0, 'novel-2')),
    ).toEqual([{ type: 'reset', total: 0 }]);
  });
});

describe('buildChapterRow', () => {
  const chapter = {
    id: 7,
    name: 'The Beginning',
    chapterNumber: 12,
    releaseTime: '2026-01-01',
    scanlator: 'Team A',
    progress: 40,
    unread: true,
    bookmark: true,
    isDownloaded: true,
  } as ChapterInfo;
  const format = {
    showChapterTitles: false,
    dateFormat: 'default' as const,
    relativeTimestamps: true,
  };

  it('formats the title and joins date, scanlator and progress', () => {
    expect(buildChapterRow(chapter, format)).toEqual({
      id: 7,
      title: 'novelScreen.chapterChapnum {"num":12}',
      subtitle:
        'date(2026-01-01) •  Team A •  novelScreen.progress {"progress":40}',
      unread: true,
      bookmarked: true,
      downloaded: true,
    });
  });

  it('uses the chapter name when titles are shown', () => {
    expect(
      buildChapterRow(chapter, { ...format, showChapterTitles: true }).title,
    ).toBe('The Beginning');
  });

  it('hides progress for read chapters and leaves an empty subtitle when nothing is known', () => {
    const read = buildChapterRow({ ...chapter, unread: false }, format);
    expect(read.subtitle).toBe('date(2026-01-01) •  Team A');
    const bare = buildChapterRow(
      { ...chapter, releaseTime: null, scanlator: null, progress: 0 },
      format,
    );
    expect(bare.subtitle).toBe('');
  });
});
