import React, {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  type NativeSyntheticEvent,
  processColor,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {
  type ChapterIdEvent,
  type ChapterListColors,
  type ChapterListStrings,
  type ChapterRowFormat,
  ChapterListViewCommands,
  ChapterListViewNativeComponent,
  type HighlightedVisibilityChangeEvent,
  type RequestRangeEvent,
} from '@modules/nitro-chapter-list';
import type { ThemeColors } from '@theme/types';
import { getString } from '@i18n/translations';

const AnimatedChapterListView = Animated.createAnimatedComponent(
  ChapterListViewNativeComponent,
);

/** Same method names as the list ref `NovelScreen` used before, so callers barely change. */
export interface NativeChapterListRef {
  /** `index` is the chapter position, excluding the header. */
  scrollToIndex: (params: {
    index: number;
    animated?: boolean;
    viewPosition?: number;
  }) => void;
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
  scrollToEnd: (params?: { animated?: boolean }) => void;
}

export type HighlightedVisibility = HighlightedVisibilityChangeEvent['state'];

interface NativeChapterListProps {
  ref?: React.Ref<NativeChapterListRef>;
  storeId: string;
  theme: ThemeColors;
  /** How native formats row text; see `buildChapterRowFormat`. */
  rowFormat: ChapterRowFormat;
  /**
   * `novel` (default): the Novel screen's rows below `header`. `drawer`: the
   * reader drawer's rows (name and date, the `highlightedId` chapter of
   * `useChapterListStore` highlighted), no header, no scroll events.
   */
  variant?: 'novel' | 'drawer';
  /** Rendered by React above the rows and scrolled with them. Omit for none. */
  header?: React.ReactNode;
  /** Row placed at the top when the list first shows rows, without a jump. */
  initialPosition?: number;
  isLocal?: boolean;
  refreshing?: boolean;
  refreshOffset?: number;
  contentPaddingTop?: number;
  contentPaddingBottom: number;
  fastScrollTopInset: number;
  fastScrollBottomInset: number;
  batchSize: number;
  /**
   * `onScroll` fires on every change only up to this offset; past it, only
   * when crossing one of `scrollEventThresholds`. Leave unset for every change.
   */
  scrollEventMaxOffset?: number;
  scrollEventThresholds?: number[];
  /** A Reanimated `useAnimatedScrollHandler`, run on the UI thread. */
  onScroll?: unknown;
  onRefresh?: () => void;
  /** `position` is the chapter's list position, excluding the header. */
  onChapterPress: (id: number, position: number) => void;
  onChapterLongPress?: (id: number, position: number) => void;
  onDownloadPress?: (id: number, position: number) => void;
  onDeletePress?: (id: number, position: number) => void;
  onRequestRange: (start: number, end: number) => void;
  /** Drawer: the highlighted chapter moved out of (or into) view. */
  onHighlightedVisibilityChange?: (state: HighlightedVisibility) => void;
  style?: StyleProp<ViewStyle>;
}

const toColor = (color: string | undefined, fallback: string): number =>
  (processColor(color ?? fallback) as number | null) ?? 0;

const rowHandler = (handler?: (id: number, position: number) => void) =>
  handler
    ? (event: NativeSyntheticEvent<ChapterIdEvent>) =>
        handler(event.nativeEvent.id, event.nativeEvent.position)
    : undefined;

// Past the end; native clamps it to the last offset.
const END_OFFSET = 1e9;

/**
 * Native RecyclerView chapter list (Android). Rows come from the
 * ChapterListStore named by `storeId`; see `useChapterListStore`.
 */
const NativeChapterList = ({
  ref,
  storeId,
  theme,
  rowFormat,
  variant = 'novel',
  header,
  initialPosition,
  isLocal = false,
  refreshing = false,
  refreshOffset = 0,
  contentPaddingTop = 0,
  contentPaddingBottom,
  fastScrollTopInset,
  fastScrollBottomInset,
  batchSize,
  scrollEventMaxOffset,
  scrollEventThresholds,
  onScroll,
  onRefresh,
  onChapterPress,
  onChapterLongPress,
  onDownloadPress,
  onDeletePress,
  onRequestRange,
  onHighlightedVisibilityChange,
  style,
}: NativeChapterListProps) => {
  const nativeRef =
    useRef<React.ComponentRef<typeof ChapterListViewNativeComponent>>(null);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: ({ index, animated = true, viewPosition = 0 }) => {
        if (nativeRef.current) {
          ChapterListViewCommands.scrollToIndex(
            nativeRef.current,
            index,
            animated,
            viewPosition,
          );
        }
      },
      scrollToOffset: ({ offset, animated = true }) => {
        if (nativeRef.current) {
          ChapterListViewCommands.scrollToOffset(
            nativeRef.current,
            offset,
            animated,
          );
        }
      },
      scrollToEnd: ({ animated = true } = {}) => {
        if (nativeRef.current) {
          ChapterListViewCommands.scrollToOffset(
            nativeRef.current,
            END_OFFSET,
            animated,
          );
        }
      },
    }),
    [],
  );

  const colors = useMemo<ChapterListColors>(() => {
    const ripple = theme.rippleColor ?? theme.outlineVariant;
    return {
      onSurface: toColor(theme.onSurface, '#000'),
      onSurfaceVariant: toColor(theme.onSurfaceVariant, '#444'),
      outline: toColor(theme.outline, '#888'),
      outlineVariant: toColor(theme.outlineVariant, '#ccc'),
      primary: toColor(theme.primary, '#00f'),
      onPrimary: toColor(theme.onPrimary, '#fff'),
      rippleColor: toColor(ripple, '#0001'),
      surface: toColor(theme.surface, '#fff'),
      selectedBackground: toColor(ripple, '#0001'),
      secondaryContainer: toColor(theme.secondaryContainer, '#ddd'),
      onSecondaryContainer: toColor(theme.onSecondaryContainer, '#000'),
    };
  }, [theme]);

  const strings = useMemo<ChapterListStrings>(
    () => ({
      deleteLabel: getString('common.delete'),
      downloadA11yLabel: getString('novelScreen.chapterDownloadA11y'),
      deleteA11yLabel: getString('novelScreen.chapterDeleteA11y'),
      downloadingA11yLabel: getString('novelScreen.chapterDownloadingA11y'),
    }),
    [],
  );

  const handleRequestRange = useCallback(
    (event: NativeSyntheticEvent<RequestRangeEvent>) =>
      onRequestRange(event.nativeEvent.start, event.nativeEvent.end),
    [onRequestRange],
  );

  const handleHighlightedVisibilityChange = useMemo(
    () =>
      onHighlightedVisibilityChange
        ? (event: NativeSyntheticEvent<HighlightedVisibilityChangeEvent>) =>
            onHighlightedVisibilityChange(event.nativeEvent.state)
        : undefined,
    [onHighlightedVisibilityChange],
  );

  return (
    <AnimatedChapterListView
      ref={nativeRef}
      style={[styles.list, style]}
      storeId={storeId}
      colors={colors}
      strings={strings}
      rowFormat={rowFormat}
      variant={variant}
      initialPosition={initialPosition}
      // Codegen casts these straight to Java booleans, and novel rows can carry
      // SQLite's 0/1 here despite the type.
      isLocal={!!isLocal}
      refreshing={!!refreshing}
      refreshOffset={refreshOffset}
      contentPaddingTop={contentPaddingTop}
      contentPaddingBottom={contentPaddingBottom}
      fastScrollTopInset={fastScrollTopInset}
      fastScrollBottomInset={fastScrollBottomInset}
      batchSize={batchSize}
      scrollEventMaxOffset={scrollEventMaxOffset}
      scrollEventThresholds={scrollEventThresholds}
      // Reanimated handlers aren't plain functions; it unwraps them itself.
      onScroll={onScroll as never}
      onRefresh={onRefresh}
      onChapterPress={rowHandler(onChapterPress)}
      onChapterLongPress={rowHandler(onChapterLongPress)}
      onDownloadPress={rowHandler(onDownloadPress)}
      onDeletePress={rowHandler(onDeletePress)}
      onRequestRange={handleRequestRange}
      onHighlightedVisibilityChange={handleHighlightedVisibilityChange}
    >
      {header === undefined ? null : (
        // Never flattened: native code hosts this view inside the RecyclerView.
        <View collapsable={false} style={styles.header}>
          {header}
        </View>
      )}
    </AnimatedChapterListView>
  );
};

export default NativeChapterList;

const styles = StyleSheet.create({
  list: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
});
