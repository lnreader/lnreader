import { useCallback, useMemo } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

export interface FastScrollMetrics {
  scrollOffset: SharedValue<number>;
  contentLength: SharedValue<number>;
  viewportLength: SharedValue<number>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export const useFastScrollMetrics = (): FastScrollMetrics => {
  const scrollOffset = useSharedValue(0);
  const contentLength = useSharedValue(0);
  const viewportLength = useSharedValue(0);

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

  return useMemo(
    () => ({ scrollOffset, contentLength, viewportLength, onScroll }),
    [scrollOffset, contentLength, viewportLength, onScroll],
  );
};
