import type * as React from 'react';
import {
  type CodegenTypes,
  type HostComponent,
  type ViewProps,
  codegenNativeCommands,
  codegenNativeComponent,
} from 'react-native';

/** Colours as `processColor` output (ARGB ints). */
export type ChapterListColors = Readonly<{
  onSurface: CodegenTypes.Int32;
  onSurfaceVariant: CodegenTypes.Int32;
  outline: CodegenTypes.Int32;
  outlineVariant: CodegenTypes.Int32;
  primary: CodegenTypes.Int32;
  onPrimary: CodegenTypes.Int32;
  rippleColor: CodegenTypes.Int32;
  surface: CodegenTypes.Int32;
  selectedBackground: CodegenTypes.Int32;
  /** Drawer variant: the highlighted (current) chapter's background and text. */
  secondaryContainer: CodegenTypes.Int32;
  onSecondaryContainer: CodegenTypes.Int32;
}>;

export type ChapterListStrings = Readonly<{
  deleteLabel: string;
  downloadA11yLabel: string;
  deleteA11yLabel: string;
  downloadingA11yLabel: string;
}>;

/**
 * How native formats row text. JS supplies everything that needs translating
 * or locale data, so native only picks and fills strings:
 * - title: `name`, or `chapterTitleTemplate` with `%{num}` filled in;
 * - subtitle: release date, scanlator and progress, joined with " •  ".
 *
 * Release dates within six days of today use `sameDay` / `lastDay` / `nextDay`
 * or the per-weekday `lastWeek` / `nextWeek` labels (index 0 is Sunday), when
 * `relativeDates` is on. Other dates use `dateFormat`: 'default' is the
 * locale's short date; anything else is a dayjs pattern of YYYY, YY, MMM, MM
 * and DD (MMM from `monthsShort`).
 */
export type ChapterRowFormat = Readonly<{
  showChapterTitles: boolean;
  chapterTitleTemplate: string;
  progressTemplate: string;
  dateFormat: string;
  relativeDates: boolean;
  locale: string;
  sameDay: string;
  lastDay: string;
  nextDay: string;
  lastWeek: ReadonlyArray<string>;
  nextWeek: ReadonlyArray<string>;
  monthsShort: ReadonlyArray<string>;
}>;

/** Shaped like ScrollView's scroll event so Reanimated can handle it. */
export type ChapterListScrollEvent = Readonly<{
  contentOffset: Readonly<{ x: CodegenTypes.Double; y: CodegenTypes.Double }>;
  contentSize: Readonly<{
    width: CodegenTypes.Double;
    height: CodegenTypes.Double;
  }>;
  layoutMeasurement: Readonly<{
    width: CodegenTypes.Double;
    height: CodegenTypes.Double;
  }>;
}>;

/** `position` is the chapter's list position (excluding the header). */
export type ChapterIdEvent = Readonly<{
  id: CodegenTypes.Int32;
  position: CodegenTypes.Int32;
}>;
export type RequestRangeEvent = Readonly<{
  start: CodegenTypes.Int32;
  end: CodegenTypes.Int32;
}>;
export type RefreshEvent = Readonly<{}>;
/** Where the highlighted chapter is relative to the visible rows. */
export type HighlightedVisibilityChangeEvent = Readonly<{
  state: 'above' | 'visible' | 'below';
}>;

export interface NativeProps extends ViewProps {
  storeId: string;
  colors: ChapterListColors;
  strings: ChapterListStrings;
  rowFormat: ChapterRowFormat;
  /**
   * `novel`: the Novel screen's list (its single child is the header).
   * `drawer`: the reader's chapter drawer: no child and no header item, name and
   * date rows, the `setHighlighted` chapter highlighted, no scroll events.
   */
  variant?: CodegenTypes.WithDefault<'novel' | 'drawer', 'novel'>;
  /** Row placed at the top before the first layout with rows; -1: the top. */
  initialPosition?: CodegenTypes.WithDefault<CodegenTypes.Int32, -1>;
  isLocal?: CodegenTypes.WithDefault<boolean, false>;
  refreshing?: CodegenTypes.WithDefault<boolean, false>;
  refreshOffset?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
  contentPaddingTop?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
  contentPaddingBottom?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
  fastScrollEnabled?: CodegenTypes.WithDefault<boolean, true>;
  fastScrollTopInset?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
  fastScrollBottomInset?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
  /** `onRequestRange` asks for whole batches of this many chapters. */
  batchSize?: CodegenTypes.WithDefault<CodegenTypes.Int32, 1000>;
  /**
   * `onScroll` fires on every change only up to this offset (negative: always);
   * past it, only when the offset crosses one of `scrollEventThresholds`.
   * Every scroll event reaches the JS thread, even when Reanimated handles it.
   */
  scrollEventMaxOffset?: CodegenTypes.WithDefault<CodegenTypes.Float, -1>;
  scrollEventThresholds?: ReadonlyArray<CodegenTypes.Float>;
  onScroll?: CodegenTypes.DirectEventHandler<ChapterListScrollEvent>;
  onChapterPress?: CodegenTypes.DirectEventHandler<ChapterIdEvent>;
  onChapterLongPress?: CodegenTypes.DirectEventHandler<ChapterIdEvent>;
  onDownloadPress?: CodegenTypes.DirectEventHandler<ChapterIdEvent>;
  onDeletePress?: CodegenTypes.DirectEventHandler<ChapterIdEvent>;
  onRefresh?: CodegenTypes.DirectEventHandler<RefreshEvent>;
  onRequestRange?: CodegenTypes.DirectEventHandler<RequestRangeEvent>;
  /** Drawer variant: sent when the highlighted chapter's visibility changes. */
  onHighlightedVisibilityChange?: CodegenTypes.DirectEventHandler<HighlightedVisibilityChangeEvent>;
}

type ChapterListViewType = HostComponent<NativeProps>;

export interface NativeCommands {
  scrollToIndex: (
    viewRef: React.ElementRef<ChapterListViewType>,
    index: CodegenTypes.Int32,
    animated: boolean,
    viewPosition: CodegenTypes.Float,
  ) => void;
  scrollToOffset: (
    viewRef: React.ElementRef<ChapterListViewType>,
    offset: CodegenTypes.Float,
    animated: boolean,
  ) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['scrollToIndex', 'scrollToOffset'],
});

export default codegenNativeComponent<NativeProps>(
  'LNChapterListView',
) as HostComponent<NativeProps>;
