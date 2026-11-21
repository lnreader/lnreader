import type { HybridObject } from 'react-native-nitro-modules';

/** One chapter row, with every display string already formatted by JS. */
export interface ChapterRow {
  id: number;
  title: string;
  /** An empty string hides the line. */
  subtitle: string;
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
