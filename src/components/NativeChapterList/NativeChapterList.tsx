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
  ChapterListViewCommands,
  ChapterListViewNativeComponent,
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
}

interface NativeChapterListProps {
  ref?: React.Ref<NativeChapterListRef>;
  storeId: string;
  theme: ThemeColors;
  /** Rendered by React above the rows and scrolled with them. */
  header: React.ReactNode;
  isLocal: boolean;
  refreshing: boolean;
  refreshOffset: number;
  contentPaddingBottom: number;
  fastScrollTopInset: number;
  fastScrollBottomInset: number;
  batchSize: number;
  /** A Reanimated `useAnimatedScrollHandler`, run on the UI thread. */
  onScroll?: unknown;
  onRefresh: () => void;
  onChapterPress: (id: number) => void;
  onChapterLongPress: (id: number) => void;
  onDownloadPress: (id: number) => void;
  onDeletePress: (id: number) => void;
  onRequestRange: (start: number, end: number) => void;
  style?: StyleProp<ViewStyle>;
}

const toColor = (color: string | undefined, fallback: string): number =>
  (processColor(color ?? fallback) as number | null) ?? 0;

const idHandler =
  (handler: (id: number) => void) =>
  (event: NativeSyntheticEvent<ChapterIdEvent>) =>
    handler(event.nativeEvent.id);

/**
 * Native RecyclerView chapter list (Android). Rows come from the
 * ChapterListStore named by `storeId`; see `useChapterListStore`.
 */
const NativeChapterList = ({
  ref,
  storeId,
  theme,
  header,
  isLocal,
  refreshing,
  refreshOffset,
  contentPaddingBottom,
  fastScrollTopInset,
  fastScrollBottomInset,
  batchSize,
  onScroll,
  onRefresh,
  onChapterPress,
  onChapterLongPress,
  onDownloadPress,
  onDeletePress,
  onRequestRange,
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

  return (
    <AnimatedChapterListView
      ref={nativeRef}
      style={[styles.list, style]}
      storeId={storeId}
      colors={colors}
      strings={strings}
      // Codegen casts these straight to Java booleans, and novel rows can carry
      // SQLite's 0/1 here despite the type.
      isLocal={!!isLocal}
      refreshing={!!refreshing}
      refreshOffset={refreshOffset}
      contentPaddingBottom={contentPaddingBottom}
      fastScrollTopInset={fastScrollTopInset}
      fastScrollBottomInset={fastScrollBottomInset}
      batchSize={batchSize}
      // Reanimated handlers aren't plain functions; it unwraps them itself.
      onScroll={onScroll as never}
      onRefresh={onRefresh}
      onChapterPress={idHandler(onChapterPress)}
      onChapterLongPress={idHandler(onChapterLongPress)}
      onDownloadPress={idHandler(onDownloadPress)}
      onDeletePress={idHandler(onDeletePress)}
      onRequestRange={handleRequestRange}
    >
      {/* Never flattened: native code hosts this view inside the RecyclerView. */}
      <View collapsable={false} style={styles.header}>
        {header}
      </View>
    </AnimatedChapterListView>
  );
};

export default NativeChapterList;

const styles = StyleSheet.create({
  list: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
});
