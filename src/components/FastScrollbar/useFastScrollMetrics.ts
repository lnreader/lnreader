import { useCallback, useMemo } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

export interface FastScrollMetrics {
  scrollOffset: SharedValue<number>;
  contentLength: SharedValue<number>;
  viewportLength: SharedValue<number>;
  /** Incremented whenever the user starts dragging the list itself. */
  userDragCount: SharedValue<number>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: () => void;
}

export const useFastScrollMetrics = (): FastScrollMetrics => {
  const scrollOffset = useSharedValue(0);
  const contentLength = useSharedValue(0);
  const viewportLength = useSharedValue(0);
  const userDragCount = useSharedValue(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      scrollOffset.set(contentOffset.y);
      if (contentSize) {
        contentLength.set(contentSize.height);
      }
      if (layoutMeasurement) {
        viewportLength.set(layoutMeasurement.height);
      }
    },
    [scrollOffset, contentLength, viewportLength],
  );

  const onScrollBeginDrag = useCallback(() => {
    userDragCount.set(userDragCount.get() + 1);
  }, [userDragCount]);

  return useMemo(
    () => ({
      scrollOffset,
      contentLength,
      viewportLength,
      userDragCount,
      onScroll,
      onScrollBeginDrag,
    }),
    [
      scrollOffset,
      contentLength,
      viewportLength,
      userDragCount,
      onScroll,
      onScrollBeginDrag,
    ],
  );
};
