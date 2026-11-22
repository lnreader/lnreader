import type { HybridObject } from 'react-native-nitro-modules';

export type GroupedChapterRowKind = 'chapter' | 'group' | 'label' | 'loading';

export interface GroupedChapterRow {
  key: string;
  kind: GroupedChapterRowKind;
  title: string;
  subtitle?: string;
  cover?: string;
  // Independent state for the two interactive row types.
  expanded?: boolean;
  unread?: boolean;
  bookmarked?: boolean;
  downloaded?: boolean;
}

export interface GroupedChapterListStore
  extends HybridObject<{ android: 'kotlin' }> {
  readonly id: string;
  setRows(rows: GroupedChapterRow[]): void;
}
