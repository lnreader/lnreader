import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@hooks/persisted';
import type { FastScrollMetrics } from './useFastScrollMetrics';
import {
  getScrollProgress,
  getThumbLength,
  progressToIndex,
} from './fastScrollMath';
import { ScrubController } from './ScrubController';

// Timings and sizes mirror androidx.recyclerview.widget.FastScroller.
const SHOW_DURATION_MS = 500;
const HIDE_DURATION_MS = 500;
const HIDE_DELAY_AFTER_VISIBLE_MS = 1500;
const HIDE_DELAY_AFTER_DRAGGING_MS = 1200;
const THICKNESS = 8;
const MINIMUM_RANGE = 50;
// Deviations from RecyclerView, which has no minimum thumb length (the thumb
// shrinks to a few pixels on lists with thousands of rows) and only accepts
// touches inside the 8dp-wide thumb itself.
const MIN_THUMB_LENGTH = 48;
const TOUCH_WIDTH = 24;

// ValueAnimator's default AccelerateDecelerateInterpolator.
const easing = Easing.inOut(Easing.sin);

export interface FastScrollbarProps {
  metrics: FastScrollMetrics;
  /** Total number of items, including ones not loaded yet. */
  itemCount: number;
  /** Number of items currently in the list's data. Defaults to `itemCount`. */
  loadedCount?: number;
  /** Called (at most once per frame) with the index under the thumb. */
  onScrub: (index: number) => void;
  onScrubEnd?: (index: number) => void;
  topInset?: number;
  bottomInset?: number;
}

const FastScrollbar = ({
  metrics,
  itemCount,
  loadedCount = itemCount,
  onScrub,
  onScrubEnd,
  topInset = 0,
  bottomInset = 0,
}: FastScrollbarProps) => {
  const theme = useTheme();
  const { scrollOffset, contentLength, viewportLength } = metrics;

  const total = useSharedValue(itemCount);
  const loaded = useSharedValue(loadedCount);
  const trackHeight = useSharedValue(0);
  const opacity = useSharedValue(0);
  const fadeInEndsAt = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragY = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastIndex = useSharedValue(-1);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    total.set(itemCount);
    loaded.set(loadedCount);
  }, [itemCount, loadedCount, total, loaded]);

  const [controller] = useState(
    () => new ScrubController({ onScrub, onScrubEnd }),
  );
  useEffect(() => {
    controller.setHandlers({ onScrub, onScrubEnd });
  }, [controller, onScrub, onScrubEnd]);
  useEffect(() => () => controller.dispose(), [controller]);

  // Worklets must capture plain functions, not the class instance.
  const { schedule, release } = controller;

  const thumbLength = useDerivedValue(() =>
    getThumbLength(
      trackHeight.get(),
      contentLength.get(),
      viewportLength.get(),
      loaded.get(),
      total.get(),
      MIN_THUMB_LENGTH,
    ),
  );

  const thumbY = useDerivedValue(() => {
    if (dragging.get()) {
      return dragY.get();
    }
    const range = Math.max(0, trackHeight.get() - thumbLength.get());
    return (
      getScrollProgress(
        scrollOffset.get(),
        contentLength.get(),
        viewportLength.get(),
        loaded.get(),
        total.get(),
      ) * range
    );
  });

  // FastScroller.show() + resetHideDelay(): fade in (500ms from the current
  // alpha, unless already in or fading in), then fade out `hideDelay` ms after
  // the most recent call. `null` cancels the pending hide (while dragging).
  const show = useCallback(
    (hideDelay: number | null) => {
      'worklet';
      const now = Date.now();
      let fadeInMs = 0;
      if (fadeInEndsAt.get() > now) {
        fadeInMs = fadeInEndsAt.get() - now;
      } else if (opacity.get() < 1) {
        fadeInMs = SHOW_DURATION_MS;
        fadeInEndsAt.set(now + SHOW_DURATION_MS);
      }
      const fadeIn = withTiming(1, { duration: fadeInMs, easing });
      if (hideDelay === null) {
        opacity.set(fadeIn);
        return;
      }
      const fadeOut = withDelay(
        Math.max(0, hideDelay - fadeInMs),
        withTiming(0, { duration: HIDE_DURATION_MS, easing }),
      );
      opacity.set(fadeInMs > 0 ? withSequence(fadeIn, fadeOut) : fadeOut);
    },
    [fadeInEndsAt, opacity],
  );

  useAnimatedReaction(
    () => scrollOffset.get(),
    (current, previous) => {
      if (previous === null || current === previous || dragging.get()) {
        return;
      }
      const scrollable =
        contentLength.get() > viewportLength.get() &&
        trackHeight.get() >= MINIMUM_RANGE &&
        total.get() > 0;
      if (scrollable) {
        show(HIDE_DELAY_AFTER_VISIBLE_MS);
      } else if (opacity.get() > 0) {
        opacity.set(0);
        fadeInEndsAt.set(0);
      }
    },
  );

  // Hidden thumbs must not swallow touches meant for list rows underneath.
  useAnimatedReaction(
    () => opacity.get() > 0.05,
    (visible, wasVisible) => {
      if (visible !== wasVisible) {
        runOnJS(setInteractive)(visible);
      }
    },
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          const y = thumbY.get();
          startY.set(y);
          dragY.set(y);
          dragging.set(true);
          lastIndex.set(-1);
          show(null);
        })
        .onUpdate(event => {
          const range = Math.max(1, trackHeight.get() - thumbLength.get());
          const y = Math.min(
            Math.max(startY.get() + event.translationY, 0),
            range,
          );
          dragY.set(y);
          const index = progressToIndex(y / range, total.get());
          if (index >= 0 && index !== lastIndex.get()) {
            lastIndex.set(index);
            runOnJS(schedule)(index);
          }
        })
        .onFinalize(() => {
          if (!dragging.get()) {
            return;
          }
          dragging.set(false);
          show(HIDE_DELAY_AFTER_DRAGGING_MS);
          runOnJS(release)(lastIndex.get());
        }),
    [
      dragY,
      dragging,
      lastIndex,
      release,
      schedule,
      show,
      startY,
      thumbLength,
      thumbY,
      total,
      trackHeight,
    ],
  );

  // FastScroller hides immediately when the RecyclerView is resized.
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (height !== trackHeight.get()) {
        trackHeight.set(height);
        opacity.set(0);
        fadeInEndsAt.set(0);
      }
    },
    [trackHeight, opacity, fadeInEndsAt],
  );

  const trackStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    height: thumbLength.get(),
    transform: [{ translateY: thumbY.get() }],
  }));

  const thumbColor = theme.onSurfaceVariant;
  const pressedThumbColor = theme.primary;
  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: dragging.get() ? pressedThumbColor : thumbColor,
  }));

  return (
    <View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[styles.container, { top: topInset, bottom: bottomInset }]}
      onLayout={onLayout}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.track,
          { backgroundColor: theme.outlineVariant },
          trackStyle,
        ]}
      />
      <GestureDetector gesture={gesture}>
        <Animated.View
          testID="fast-scrollbar-thumb"
          style={[styles.thumbTouchArea, thumbStyle]}
        >
          <Animated.View style={[styles.thumb, barStyle]} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default React.memo(FastScrollbar);

// `end` rather than `right` so the scrollbar moves to the left edge in RTL,
// as FastScroller does.
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    end: 0,
    width: TOUCH_WIDTH,
  },
  track: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    end: 0,
    width: THICKNESS,
    borderRadius: THICKNESS / 2,
  },
  thumbTouchArea: {
    position: 'absolute',
    top: 0,
    end: 0,
    width: TOUCH_WIDTH,
    alignItems: 'flex-end',
  },
  thumb: {
    flex: 1,
    width: THICKNESS,
    borderRadius: THICKNESS / 2,
  },
});
