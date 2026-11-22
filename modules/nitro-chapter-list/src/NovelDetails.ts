/** Small presentation snapshot for the Android Novel screen. Chapters use the list store. */
export interface NovelDetailsAction {
  id: string;
  label: string;
  glyph?: string;
  active?: boolean;
  longPressId?: string;
  menu?: readonly NovelDetailsAction[];
}

export interface NovelDetails {
  title: string;
  author?: string;
  artist?: string;
  source: string;
  authorGlyph: string;
  artistGlyph: string;
  sourceGlyph: string;
  cover?: string;
  coverHeaders?: Record<string, string>;
  coverLabel: string;
  coverActions: readonly NovelDetailsAction[];
  coverGlyph: string;
  summary: string;
  expandLabel: string;
  collapseLabel: string;
  expandGlyph: string;
  collapseGlyph: string;
  genres: readonly string[];
  expandedSummary: boolean;
  hideBackdrop: boolean;
  reduceMotion: boolean;
  busy: boolean;
  error?: string;
  chapterLabel: string;
  filter: NovelDetailsAction;
  filterActiveColor: number;
  actions: readonly NovelDetailsAction[];
  toolbar: readonly NovelDetailsAction[];
  selectionToolbar?: readonly NovelDetailsAction[];
  selectionActions?: readonly NovelDetailsAction[];
  selectionKey?: string;
  selectionHaptics?: boolean;
  read?: NovelDetailsAction;
  resume?: NovelDetailsAction;
  scrollToTop: NovelDetailsAction;
  pages: readonly NovelDetailsAction[];
  topInset: number;
  bottomInset: number;
  background: number;
  toolbarColor: number;
  errorColor: number;
  chapterSettings?: ChapterSettingsPanel;
  chapterJump?: ChapterJumpPanel;
  chapterControlScope?: string;
}

export interface ChapterSettingsPanel {
  tabs: readonly string[];
  labels: Record<string, string>;
  glyphs: Record<string, string>;
  filters: readonly string[];
  sort: string;
  showTitles: boolean;
  scanlators: readonly string[];
  excludedScanlators: readonly string[];
}

export interface ChapterJumpPanel {
  labels: Record<string, string>;
  maxNumber?: number;
}

export interface ChapterJumpResult {
  requestId: number;
  error?: string;
  index?: number;
  matches?: readonly { id: number; title: string; date?: string }[];
}
