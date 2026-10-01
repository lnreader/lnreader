import {
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  LegendList,
  type LegendListRef,
  type ViewabilityConfig,
  type ViewToken,
} from '@legendapp/list/react-native';
import { useTheme } from '@hooks/persisted/useTheme';
import AppHost from '../AppHost/AppHost';

export interface ComposeListHandle {
  scrollToIndex: (
    index: number,
    options?: { animated?: boolean; viewPosition?: number },
  ) => void;
  scrollToTop: () => void;
  scrollToEnd: (options?: { animated?: boolean }) => void;
}

export interface ComposeListProps<T> {
  ref?: Ref<ComposeListHandle>;
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  /** State outside `data` that rows render from. */
  extraData?: unknown;
  /** Compose content; each row is hosted on its own. */
  renderItem: (item: T, index: number) => ReactNode;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onViewableItemsChanged?: (info: { viewableItems: ViewToken<T>[] }) => void;
  viewabilityConfig?: ViewabilityConfig;
  /**
   * Index of the first visible item; negative while a header is first
   * (`-headers.length` for the first header).
   */
  onFirstVisibleIndexChange?: (index: number) => void;
  header?: ReactElement | readonly ReactElement[] | null;
  footer?: ReactElement | null;
  initialIndex?: number;
  /** Where `initialIndex` sits: 0 at the top, 0.5 centred. */
  initialViewPosition?: number;
  contentPadding?: { top?: number; bottom?: number; horizontal?: number };
  verticalSpacing?: number;
  estimatedItemSize?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

// A matchContents host only gets its height once Compose has measured it,
// and LegendList sizes its pool of rows from the first layout: at 1px a row
// it would mount every row, each its own ComposeView. Rows keep the estimated
// height until their content reports one.
const Hosted = ({
  children,
  estimatedSize,
}: {
  children: ReactNode;
  estimatedSize?: number;
}) => {
  const [measured, setMeasured] = useState(false);
  return (
    <View style={{ minHeight: measured ? 1 : estimatedSize ?? 1 }}>
      <AppHost
        matchContents={{ vertical: true }}
        onLayoutContent={
          measured
            ? undefined
            : event => {
                if (event.nativeEvent.height > 0) {
                  setMeasured(true);
                }
              }
        }
      >
        {children}
      </AppHost>
    </View>
  );
};

const DEFAULT_ROW_ESTIMATE = 48;

export function ComposeList<T>({
  ref,
  data,
  keyExtractor,
  extraData,
  renderItem,
  onEndReached,
  onEndReachedThreshold = 0.5,
  onScroll,
  onViewableItemsChanged,
  viewabilityConfig,
  onFirstVisibleIndexChange,
  header,
  footer,
  initialIndex,
  initialViewPosition,
  contentPadding,
  verticalSpacing,
  estimatedItemSize,
  refreshing,
  onRefresh,
}: ComposeListProps<T>) {
  const theme = useTheme();
  const listRef = useRef<LegendListRef>(null);
  const headers = header ? (Array.isArray(header) ? header : [header]) : [];
  const headerHeights = useRef<number[]>([]);
  const firstItem = useRef(0);
  const offset = useRef(0);
  const reported = useRef<number | undefined>(undefined);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) =>
      void listRef.current?.scrollToIndex({
        index: Math.max(0, Math.min(index, data.length - 1)),
        animated: options?.animated ?? true,
        viewPosition: options?.viewPosition,
      }),
    scrollToTop: () =>
      void listRef.current?.scrollToOffset({ offset: 0, animated: true }),
    scrollToEnd: options =>
      void listRef.current?.scrollToEnd({
        animated: options?.animated ?? true,
      }),
  }));

  const report = () => {
    if (!onFirstVisibleIndexChange) {
      return;
    }
    let top = offset.current - (contentPadding?.top ?? 0);
    let index = firstItem.current;
    for (let i = 0; i < headers.length; i++) {
      const height = headerHeights.current[i] ?? 0;
      if (top < height) {
        index = i - headers.length;
        break;
      }
      top -= height;
    }
    if (reported.current !== index) {
      reported.current = index;
      onFirstVisibleIndexChange(index);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll?.(event);
    offset.current = event.nativeEvent.contentOffset.y;
    report();
  };

  const handleViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: ViewToken<T>[];
  }) => {
    onViewableItemsChanged?.({ viewableItems });
    const indices = viewableItems
      .map(token => token.index)
      .filter(index => index >= 0);
    firstItem.current = indices.length ? Math.min(...indices) : 0;
    report();
  };

  return (
    <View style={styles.fill}>
      <LegendList
        ref={listRef}
        data={data}
        extraData={extraData}
        keyExtractor={keyExtractor}
        renderItem={({ item, index }) => (
          <Hosted estimatedSize={estimatedItemSize ?? DEFAULT_ROW_ESTIMATE}>
            {renderItem(item, index)}
          </Hosted>
        )}
        ListHeaderComponent={
          headers.length ? (
            <View>
              {headers.map((element, index) => (
                <View
                  key={index}
                  onLayout={event => {
                    headerHeights.current[index] =
                      event.nativeEvent.layout.height;
                  }}
                >
                  <Hosted>{element}</Hosted>
                </View>
              ))}
            </View>
          ) : undefined
        }
        ListFooterComponent={footer ? <Hosted>{footer}</Hosted> : undefined}
        ItemSeparatorComponent={
          verticalSpacing
            ? () => <View style={{ height: verticalSpacing }} />
            : undefined
        }
        contentContainerStyle={{
          paddingTop: contentPadding?.top,
          paddingBottom: contentPadding?.bottom,
          paddingHorizontal: contentPadding?.horizontal,
        }}
        initialScrollIndex={
          initialIndex !== undefined && initialViewPosition
            ? { index: initialIndex, viewPosition: initialViewPosition }
            : initialIndex
        }
        estimatedItemSize={estimatedItemSize}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        onScroll={
          onFirstVisibleIndexChange || onScroll ? handleScroll : undefined
        }
        scrollEventThrottle={onScroll ? 32 : undefined}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={
          onFirstVisibleIndexChange || onViewableItemsChanged
            ? handleViewableItemsChanged
            : undefined
        }
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              progressBackgroundColor={theme.surfaceContainerHigh}
            />
          ) : undefined
        }
        recycleItems
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
