import type * as React from 'react';
import type { HostComponent, ViewProps } from 'react-native';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type {
  DirectEventHandler,
  Double,
  Float,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

/** Colours as `processColor` output (ARGB ints). */
export type ChapterListColors = Readonly<{
  onSurface: Int32;
  onSurfaceVariant: Int32;
  outline: Int32;
  outlineVariant: Int32;
  primary: Int32;
  onPrimary: Int32;
  rippleColor: Int32;
  surface: Int32;
  selectedBackground: Int32;
  /** Drawer variant: the highlighted (current) chapter's background and text. */
  secondaryContainer: Int32;
  onSecondaryContainer: Int32;
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
  contentOffset: Readonly<{ x: Double; y: Double }>;
  contentSize: Readonly<{ width: Double; height: Double }>;
  layoutMeasurement: Readonly<{ width: Double; height: Double }>;
}>;

/** `position` is the chapter's list position (excluding the header). */
export type ChapterIdEvent = Readonly<{ id: Int32; position: Int32 }>;
export type RequestRangeEvent = Readonly<{ start: Int32; end: Int32 }>;
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
  variant?: WithDefault<'novel' | 'drawer', 'novel'>;
  /** Row placed at the top before the first layout with rows; -1: the top. */
  initialPosition?: WithDefault<Int32, -1>;
  isLocal?: WithDefault<boolean, false>;
  refreshing?: WithDefault<boolean, false>;
  refreshOffset?: WithDefault<Float, 0>;
  contentPaddingTop?: WithDefault<Float, 0>;
  contentPaddingBottom?: WithDefault<Float, 0>;
  fastScrollTopInset?: WithDefault<Float, 0>;
  fastScrollBottomInset?: WithDefault<Float, 0>;
  /** `onRequestRange` asks for whole batches of this many chapters. */
  batchSize?: WithDefault<Int32, 1000>;
  /**
   * `onScroll` fires on every change only up to this offset (negative: always);
   * past it, only when the offset crosses one of `scrollEventThresholds`.
   * Every scroll event reaches the JS thread, even when Reanimated handles it.
   */
  scrollEventMaxOffset?: WithDefault<Float, -1>;
  scrollEventThresholds?: ReadonlyArray<Float>;
  onScroll?: DirectEventHandler<ChapterListScrollEvent>;
  onChapterPress?: DirectEventHandler<ChapterIdEvent>;
  onChapterLongPress?: DirectEventHandler<ChapterIdEvent>;
  onDownloadPress?: DirectEventHandler<ChapterIdEvent>;
  onDeletePress?: DirectEventHandler<ChapterIdEvent>;
  onRefresh?: DirectEventHandler<RefreshEvent>;
  onRequestRange?: DirectEventHandler<RequestRangeEvent>;
  /** Drawer variant: sent when the highlighted chapter's visibility changes. */
  onHighlightedVisibilityChange?: DirectEventHandler<HighlightedVisibilityChangeEvent>;
}

type ChapterListViewType = HostComponent<NativeProps>;

export interface NativeCommands {
  scrollToIndex: (
    viewRef: React.ElementRef<ChapterListViewType>,
    index: Int32,
    animated: boolean,
    viewPosition: Float,
  ) => void;
  scrollToOffset: (
    viewRef: React.ElementRef<ChapterListViewType>,
    offset: Float,
    animated: boolean,
  ) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['scrollToIndex', 'scrollToOffset'],
});

export default codegenNativeComponent<NativeProps>(
  'LNChapterListView',
) as HostComponent<NativeProps>;
