import { type RefCallback, useCallback, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, {
  type AnimatedRef,
  type SharedValue,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated';

export interface FastScrollListProps {
  refScrollView: RefCallback<unknown>;
  sharedValues: { scrollOffset: SharedValue<number> };
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: () => void;
}

export interface FastScrollMetrics {
  /** Updated on the UI thread by AnimatedLegendList, in sync with the native view. */
  scrollOffset: SharedValue<number>;
  contentLength: SharedValue<number>;
  viewportLength: SharedValue<number>;
  /** Incremented whenever the user starts dragging the list itself. */
  userDragCount: SharedValue<number>;
  scrollViewRef: AnimatedRef<Animated.ScrollView>;
  /** Spread onto the AnimatedLegendList the scrollbar controls. */
  listProps: FastScrollListProps;
}

export const useFastScrollMetrics = (): FastScrollMetrics => {
  const scrollOffset = useSharedValue(0);
  const contentLength = useSharedValue(0);
  const viewportLength = useSharedValue(0);
  const userDragCount = useSharedValue(0);
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  // JS-side copies, so unchanged sizes (nearly every event) skip the write;
  // each shared value write from JS is a hop to the UI thread.
  const lastSizes = useRef({ content: -1, viewport: -1, drags: 0 });

  // The offset itself comes from the UI thread; writing it here as well would
  // let late JS events overwrite newer values.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentSize, layoutMeasurement } = event.nativeEvent;
      const last = lastSizes.current;
      if (contentSize && contentSize.height !== last.content) {
        last.content = contentSize.height;
        contentLength.set(contentSize.height);
      }
      if (layoutMeasurement && layoutMeasurement.height !== last.viewport) {
        last.viewport = layoutMeasurement.height;
        viewportLength.set(layoutMeasurement.height);
      }
    },
    [contentLength, viewportLength],
  );

  const onScrollBeginDrag = useCallback(() => {
    lastSizes.current.drags += 1;
    userDragCount.set(lastSizes.current.drags);
  }, [userDragCount]);

  const listProps = useMemo(
    () => ({
      // AnimatedRef is a ref callback that returns a native handle, which
      // React 19's ref typings reject even though it is the intended usage.
      refScrollView: scrollViewRef as unknown as RefCallback<unknown>,
      sharedValues: { scrollOffset },
      onScroll,
      onScrollBeginDrag,
    }),
    [scrollViewRef, scrollOffset, onScroll, onScrollBeginDrag],
  );

  return useMemo(
    () => ({
      scrollOffset,
      contentLength,
      viewportLength,
      userDragCount,
      scrollViewRef,
      listProps,
    }),
    [
      scrollOffset,
      contentLength,
      viewportLength,
      userDragCount,
      scrollViewRef,
      listProps,
    ],
  );
};
