import type {
  ChapterGeneralSettings,
  ChapterReaderSettings,
  PageAnimation,
  ReaderColumns,
} from '@hooks/persisted/useSettings';

export type ReaderFlow = 'paginated' | 'scrolled';
export type PageTurn = 'none' | PageAnimation;
export type ReaderTextAlign = 'start' | 'left' | 'center' | 'right' | 'justify';

export interface ReaderPreferences {
  fontFamily: string;
  /** px */
  fontSize: number;
  lineHeight: number;
  /** em */
  paragraphSpacing: number;
  /** em */
  textIndent: number;
  textAlign: ReaderTextAlign;
  backgroundColor: string;
  textColor: string;
  flow: ReaderFlow;
  /** px, left and right */
  padding: number;
  columns: ReaderColumns;
  animation: PageTurn;
  continuousChapters: boolean;
  tapToScroll: boolean;
  swipeGestures: boolean;
  showChapterTitle: boolean;
  bionicReading: boolean;
  removeExtraParagraphSpacing: boolean;
  showProgress: boolean;
  showBatteryAndTime: boolean;
  customCss: string;
  cssVariables: Record<string, string>;
}

/** Mirrors the persisted defaults (useSettings) without importing the app. */
export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  fontFamily: '',
  fontSize: 16,
  lineHeight: 1.5,
  paragraphSpacing: 1,
  textIndent: 0,
  textAlign: 'left',
  backgroundColor: '#292832',
  textColor: '#CCCCCC',
  flow: 'scrolled',
  padding: 16,
  columns: 'auto',
  animation: 'push',
  continuousChapters: true,
  tapToScroll: false,
  swipeGestures: false,
  showChapterTitle: false,
  bionicReading: false,
  removeExtraParagraphSpacing: false,
  showProgress: true,
  showBatteryAndTime: false,
  customCss: '',
  cssVariables: {},
};

const D = DEFAULT_READER_PREFERENCES;

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const PAGE_ANIMATIONS: readonly PageAnimation[] = ['push', 'slide', 'curl'];

const toColumns = (value: unknown): ReaderColumns =>
  value === 1 || value === 2 ? value : 'auto';

const TEXT_ALIGNS: readonly ReaderTextAlign[] = [
  'start',
  'left',
  'center',
  'right',
  'justify',
];

export const toReaderPreferences = (
  reader: ChapterReaderSettings,
  general: ChapterGeneralSettings,
  customCss = '',
  cssVariables: Record<string, string> = {},
): ReaderPreferences => ({
  fontFamily:
    typeof reader.fontFamily === 'string' ? reader.fontFamily : D.fontFamily,
  fontSize: clamp(reader.textSize, 8, 64, D.fontSize),
  lineHeight: clamp(reader.lineHeight, 1, 3, D.lineHeight),
  paragraphSpacing: clamp(reader.paragraphSpacing, 0, 4, D.paragraphSpacing),
  textIndent: clamp(reader.textIndent, 0, 4, D.textIndent),
  textAlign: TEXT_ALIGNS.includes(reader.textAlign as ReaderTextAlign)
    ? (reader.textAlign as ReaderTextAlign)
    : D.textAlign,
  backgroundColor: reader.theme || D.backgroundColor,
  textColor: reader.textColor || D.textColor,
  flow: general.pageReader ? 'paginated' : 'scrolled',
  padding: clamp(reader.padding, 0, 160, D.padding),
  columns: toColumns(reader.columns),
  animation: general.pageReaderDisableAnimation
    ? 'none'
    : PAGE_ANIMATIONS.includes(general.pageAnimation)
    ? general.pageAnimation
    : D.animation,
  continuousChapters: general.continuousChapters !== false,
  tapToScroll: general.tapToScroll === true,
  swipeGestures: general.swipeGestures === true,
  showChapterTitle: reader.showChapterTitle === true,
  bionicReading: general.bionicReading === true,
  removeExtraParagraphSpacing: general.removeExtraParagraphSpacing === true,
  showProgress: general.showScrollPercentage !== false,
  showBatteryAndTime: general.showBatteryAndTime === true,
  customCss,
  cssVariables,
});
