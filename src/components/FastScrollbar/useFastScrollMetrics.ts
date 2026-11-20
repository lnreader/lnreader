import { type RefCallback, useCallback, useMemo } from 'react';
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

  // The offset itself comes from the UI thread; writing it here as well would
  // let late JS events overwrite newer values.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentSize, layoutMeasurement } = event.nativeEvent;
      if (contentSize) {
        contentLength.set(contentSize.height);
      }
      if (layoutMeasurement) {
        viewportLength.set(layoutMeasurement.height);
      }
    },
    [contentLength, viewportLength],
  );

  const onScrollBeginDrag = useCallback(() => {
    userDragCount.set(userDragCount.get() + 1);
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
