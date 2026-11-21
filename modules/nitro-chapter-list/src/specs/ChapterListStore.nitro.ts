import type { HybridObject } from 'react-native-nitro-modules';

/**
 * One chapter row as raw values. Native formats the visible text when a row is
 * bound, following the list's `rowFormat` prop; JS only parses and translates.
 */
export interface ChapterRow {
  id: number;
  /** Shown when the list shows chapter titles. */
  name: string;
  /** `String(chapterNumber)`, filled into the "Chapter %{num}" title. */
  numberText: string;
  /** Release time in epoch ms, when JS could parse one. */
  releaseTime?: number;
  /** Release text shown as is when it couldn't be parsed; '' when none. */
  releaseText: string;
  /** '' when none. */
  scanlator: string;
  /** Reading progress in percent; shown for unread chapters when above 0. */
  progress: number;
  unread: boolean;
  bookmarked: boolean;
  downloaded: boolean;
}

/**
 * Row data for a native chapter list. JS writes, the list view reads.
 * A view binds to a store through its `id`.
 */
export interface ChapterListStore extends HybridObject<{ android: 'kotlin' }> {
  readonly id: string;
  /** Replaces everything (new novel, page, sort or filter). */
  reset(totalCount: number): void;
  /** Writes rows starting at list position `start` (batch arrival or edits). */
  setRows(start: number, rows: ChapterRow[]): void;
  /** Patches rows by id (read state, bookmark, downloaded...). */
  updateRows(rows: ChapterRow[]): void;
  setSelected(ids: number[]): void;
  setDownloading(ids: number[]): void;
}
