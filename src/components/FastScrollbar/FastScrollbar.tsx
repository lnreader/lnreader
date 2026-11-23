import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, PixelRatio, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@hooks/persisted';
import type { FastScrollMetrics } from './useFastScrollMetrics';
import { getScrollProgress, progressToIndex } from './fastScrollMath';
import { type MeasurableList, PendingScrub } from './PendingScrub';

// Keep the appearance and timings in sync with the native ListFastScroller.
const SHOW_DURATION_MS = 500;
const HIDE_DURATION_MS = 500;
const HIDE_DELAY_AFTER_VISIBLE_MS = 1500;
const HIDE_DELAY_AFTER_DRAGGING_MS = 1200;
const THICKNESS = 12;
const THUMB_LENGTH = 48;
const EDGE_MARGIN = 8;
const TOUCH_WIDTH = 32;
const MINIMUM_RANGE = 50;
// Native scroll offsets are rounded to whole pixels.
const SETTLE_TOLERANCE = 1.5;
const SETTLE_TIMEOUT_MS = 500;
const PENDING_SETTLE_TIMEOUT_MS = 3000;
const SETTLE_CORRECTION_MS = 150;

// ValueAnimator's default AccelerateDecelerateInterpolator.
const easing = Easing.inOut(Easing.sin);

// Replaced with the real target in an effect, before any gesture can run.
const INITIAL_TARGET = {
  getList: () => null,
  itemCount: 0,
  loadedCount: 0,
  onResolved: () => {},
};

export interface FastScrollbarProps {
  /** From useFastScrollMetrics; its `listProps` must be on the list. */
  metrics: FastScrollMetrics;
  /** Only needed with `onRequestItems`, to measure newly loaded items. */
  listRef?: React.RefObject<MeasurableList | null>;
  /** Total number of items, including ones not loaded yet. */
  itemCount: number;
  /** Number of items currently in the list's data. Defaults to `itemCount`. */
  loadedCount?: number;
  /** Asked to load items up to `index` when scrubbing past the loaded ones. */
  onRequestItems?: (index: number) => void;
  /**
   * Identifies the data set (e.g. page, sort and filter). Changing it drops a
   * scrub that is still waiting for items, so it cannot land in the new list.
   */
  dataKey?: unknown;
  topInset?: number;
  bottomInset?: number;
}

const FastScrollbar = ({
  metrics,
  listRef,
  itemCount,
  loadedCount = itemCount,
  onRequestItems,
  dataKey,
  topInset = 0,
  bottomInset = 0,
}: FastScrollbarProps) => {
  const theme = useTheme();
  const {
    scrollOffset,
    contentLength,
    viewportLength,
    userDragCount,
    scrollViewRef,
  } = metrics;

  const total = useSharedValue(itemCount);
  const loaded = useSharedValue(loadedCount);
  const trackHeight = useSharedValue(0);
  const opacity = useSharedValue(0);
  const fadeInEndsAt = useSharedValue(0);
  // When the fade-out should start; -1 while dragging (no pending hide).
  const hideAt = useSharedValue(-1);
  const hideTimer = useSharedValue(0);
  const hideTimerArmed = useSharedValue(false);
  const dragging = useSharedValue(false);
  const dragY = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastScrolledOffset = useSharedValue(-1);
  const awaitingItems = useSharedValue(false);
  const lastRequestedIndex = useSharedValue(-1);
  // After a drag the thumb stays where the finger left it until the list
  // reports the final offset, then any residual gap is animated away.
  const settling = useSharedValue(false);
  const settleOffset = useSharedValue(-1);
  const settleTimer = useSharedValue(0);
  const correction = useSharedValue(0);
  const [interactive, setInteractive] = useState(false);
  const pixelRatio = PixelRatio.get();

  useEffect(() => {
    total.set(itemCount);
    loaded.set(loadedCount);
  }, [itemCount, loadedCount, total, loaded]);

  const canFastScroll = useDerivedValue(() => {
    const viewport = viewportLength.get();
    return (
      viewport > 0 &&
      contentLength.get() >= 2 * viewport &&
      trackHeight.get() >= MINIMUM_RANGE &&
      total.get() > 0
    );
  });

  const [pending] = useState(() => new PendingScrub(INITIAL_TARGET));
  // Worklets must capture plain functions, not the class instance.
  const { request: requestItems, cancel: cancelPending } = pending;

  // Drops a scrub waiting on unloaded items on both threads, so it can never
  // scroll the list after the user has moved on.
  const abandonPendingScrub = useCallback(() => {
    'worklet';
    if (awaitingItems.get()) {
      awaitingItems.set(false);
      lastRequestedIndex.set(-1);
      runOnJS(cancelPending)();
    }
  }, [awaitingItems, cancelPending, lastRequestedIndex]);

  const scrollThumbY = useCallback(() => {
    'worklet';
    const range = Math.max(0, trackHeight.get() - THUMB_LENGTH);
    return (
      getScrollProgress(
        scrollOffset.get(),
        contentLength.get(),
        viewportLength.get(),
        loaded.get(),
        total.get(),
      ) * range
    );
  }, [contentLength, loaded, scrollOffset, total, trackHeight, viewportLength]);

  const endSettle = useCallback(() => {
    'worklet';
    if (!settling.get() || dragging.get()) {
      return;
    }
    cancelAnimation(settleTimer);
    correction.set(dragY.get() - scrollThumbY());
    correction.set(
      withTiming(0, {
        duration: SETTLE_CORRECTION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    settling.set(false);
    settleOffset.set(-1);
    abandonPendingScrub();
  }, [
    abandonPendingScrub,
    correction,
    dragY,
    dragging,
    scrollThumbY,
    settleOffset,
    settleTimer,
    settling,
  ]);

  const startSettleTimer = useCallback(
    (ms: number) => {
      'worklet';
      cancelAnimation(settleTimer);
      settleTimer.set(0);
      settleTimer.set(
        withDelay(
          ms,
          withTiming(1, { duration: 0 }, finished => {
            if (finished) {
              endSettle();
            }
          }),
        ),
      );
    },
    [endSettle, settleTimer],
  );

  const settleAt = useCallback(
    (offset: number) => {
      'worklet';
      if (!settling.get() || dragging.get()) {
        return;
      }
      settleOffset.set(offset);
      if (Math.abs(scrollOffset.get() - offset) <= SETTLE_TOLERANCE) {
        endSettle();
      } else {
        startSettleTimer(SETTLE_TIMEOUT_MS);
      }
    },
    [
      dragging,
      endSettle,
      scrollOffset,
      settleOffset,
      settling,
      startSettleTimer,
    ],
  );

  const scrollToOffset = useCallback(
    (offset: number) => {
      'worklet';
      // The native view can only land on whole physical pixels; skip pan
      // updates that would not move it.
      const snapped = Math.round(offset * pixelRatio) / pixelRatio;
      if (snapped === lastScrolledOffset.get()) {
        return;
      }
      scrollTo(scrollViewRef, 0, snapped, false);
      lastScrolledOffset.set(snapped);
    },
    [lastScrolledOffset, pixelRatio, scrollViewRef],
  );

  const resolvePendingScrub = useCallback(
    (offset: number) => {
      'worklet';
      // Resolutions already in flight when the scrub was abandoned.
      if (!awaitingItems.get()) {
        return;
      }
      awaitingItems.set(false);
      lastRequestedIndex.set(-1);
      scrollToOffset(offset);
      settleAt(offset);
    },
    [awaitingItems, lastRequestedIndex, scrollToOffset, settleAt],
  );

  useEffect(() => {
    pending.setTarget({
      getList: () => listRef?.current,
      itemCount,
      loadedCount,
      onRequestItems,
      onResolved: offset => runOnUI(resolvePendingScrub)(offset),
    });
  }, [
    itemCount,
    listRef,
    loadedCount,
    onRequestItems,
    pending,
    resolvePendingScrub,
  ]);
  useEffect(() => () => pending.dispose(), [pending]);

  const resetForNewData = useCallback(() => {
    'worklet';
    abandonPendingScrub();
    endSettle();
  }, [abandonPendingScrub, endSettle]);

  useEffect(() => {
    pending.cancel();
    runOnUI(resetForNewData)();
  }, [dataKey, pending, resetForNewData]);

  const thumbY = useDerivedValue(() => {
    if (dragging.get() || settling.get()) {
      return dragY.get();
    }
    return scrollThumbY() + correction.get();
  });

  // FastScroller.show(): fade in over 500ms from the current alpha, unless
  // already visible or fading in.
  const show = useCallback(() => {
    'worklet';
    const now = Date.now();
    if (fadeInEndsAt.get() > now || opacity.get() >= 1) {
      return;
    }
    fadeInEndsAt.set(now + SHOW_DURATION_MS);
    opacity.set(withTiming(1, { duration: SHOW_DURATION_MS, easing }));
  }, [fadeInEndsAt, opacity]);

  // Like FastScroller's delayed hide runnable, but re-armed lazily: scrolling
  // only moves the deadline, and the timer checks it when it fires. Per-frame
  // scroll work stays a timestamp write instead of rebuilding the fade
  // animation on every event.
  const armHideTimer = useCallback(
    (delay: number) => {
      'worklet';
      hideTimerArmed.set(true);
      hideTimer.set(0);
      hideTimer.set(withDelay(delay, withTiming(1, { duration: 0 })));
    },
    [hideTimer, hideTimerArmed],
  );

  useAnimatedReaction(
    () => hideTimer.get() === 1,
    (fired, wasFired) => {
      if (!fired || wasFired || !hideTimerArmed.get()) {
        return;
      }
      const deadline = hideAt.get();
      const remaining = deadline - Date.now();
      if (deadline < 0) {
        hideTimerArmed.set(false);
      } else if (remaining > 16) {
        armHideTimer(remaining);
      } else {
        hideTimerArmed.set(false);
        hideAt.set(-1);
        fadeInEndsAt.set(0);
        opacity.set(withTiming(0, { duration: HIDE_DURATION_MS, easing }));
      }
    },
  );

  const scheduleHide = useCallback(
    (delay: number) => {
      'worklet';
      hideAt.set(Date.now() + delay);
      if (!hideTimerArmed.get()) {
        armHideTimer(delay);
      }
    },
    [armHideTimer, hideAt, hideTimerArmed],
  );

  useAnimatedReaction(
    () => ({ offset: scrollOffset.get(), available: canFastScroll.get() }),
    (current, previous) => {
      if (!current.available) {
        if (opacity.get() > 0 || fadeInEndsAt.get() > 0) {
          hideAt.set(-1);
          opacity.set(0);
          fadeInEndsAt.set(0);
        }
        return;
      }
      if (!previous || current.offset === previous.offset || dragging.get()) {
        return;
      }
      if (settling.get()) {
        const target = settleOffset.get();
        if (
          target >= 0 &&
          Math.abs(current.offset - target) <= SETTLE_TOLERANCE
        ) {
          endSettle();
        }
        return;
      }
      show();
      scheduleHide(HIDE_DELAY_AFTER_VISIBLE_MS);
    },
  );

  // The user grabbed the list itself; stop holding the thumb in place.
  useAnimatedReaction(
    () => userDragCount.get(),
    (current, previous) => {
      if (previous !== null && current !== previous) {
        abandonPendingScrub();
        endSettle();
      }
    },
  );

  // Hidden thumbs must not swallow touches meant for list rows underneath.
  useAnimatedReaction(
    () => canFastScroll.get() && opacity.get() > 0.05,
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
          if (!canFastScroll.get()) {
            return;
          }
          const y = thumbY.get();
          cancelAnimation(settleTimer);
          startY.set(y);
          dragY.set(y);
          correction.set(0);
          dragging.set(true);
          settling.set(true);
          settleOffset.set(-1);
          lastScrolledOffset.set(-1);
          lastRequestedIndex.set(-1);
          hideAt.set(-1);
          show();
        })
        .onUpdate(event => {
          if (!dragging.get() || !canFastScroll.get()) {
            return;
          }
          const range = trackHeight.get() - THUMB_LENGTH;
          const y = Math.min(
            Math.max(startY.get() + event.translationY, 0),
            range,
          );
          if (y === dragY.get()) {
            return;
          }
          dragY.set(y);
          const progress = y / range;
          const totalCount = total.get();
          const loadedItems = loaded.get();
          const loadedProgress =
            loadedItems >= totalCount
              ? progress
              : (progress * totalCount) / Math.max(1, loadedItems);
          if (loadedProgress <= 1) {
            abandonPendingScrub();
            // Scrolling the native view straight from the gesture keeps the
            // list in step with the thumb and lets LegendList treat it like a
            // user fling, without its programmatic-scroll bookkeeping.
            scrollToOffset(
              loadedProgress *
                Math.max(0, contentLength.get() - viewportLength.get()),
            );
          } else {
            awaitingItems.set(true);
            const index = Math.max(
              loadedItems,
              progressToIndex(progress, totalCount),
            );
            if (index !== lastRequestedIndex.get()) {
              lastRequestedIndex.set(index);
              runOnJS(requestItems)(progress, index);
            }
          }
        })
        .onFinalize(() => {
          if (!dragging.get()) {
            return;
          }
          dragging.set(false);
          scheduleHide(HIDE_DELAY_AFTER_DRAGGING_MS);
          if (awaitingItems.get()) {
            startSettleTimer(PENDING_SETTLE_TIMEOUT_MS);
          } else if (lastScrolledOffset.get() >= 0) {
            settleAt(lastScrolledOffset.get());
          } else {
            endSettle();
          }
        }),
    [
      abandonPendingScrub,
      awaitingItems,
      canFastScroll,
      contentLength,
      correction,
      dragY,
      dragging,
      endSettle,
      hideAt,
      lastRequestedIndex,
      lastScrolledOffset,
      loaded,
      requestItems,
      scrollToOffset,
      settleAt,
      settleOffset,
      settleTimer,
      settling,
      scheduleHide,
      show,
      startSettleTimer,
      startY,
      thumbY,
      total,
      trackHeight,
      viewportLength,
    ],
  );

  // FastScroller hides immediately when the RecyclerView is resized.
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (height !== trackHeight.get()) {
        trackHeight.set(height);
        hideAt.set(-1);
        opacity.set(0);
        fadeInEndsAt.set(0);
      }
    },
    [trackHeight, hideAt, opacity, fadeInEndsAt],
  );

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const thumbPositionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: thumbY.get() }],
  }));

  const { primary, onSurface } = theme;
  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: dragging.get()
      ? interpolateColor(0.3, [0, 1], [primary, onSurface], 'RGB', { gamma: 1 })
      : primary,
  }));

  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[
        styles.container,
        { top: topInset, bottom: bottomInset },
        containerStyle,
      ]}
      onLayout={onLayout}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          testID="fast-scrollbar-thumb"
          style={[styles.thumbTouchArea, thumbPositionStyle]}
        >
          <Animated.View style={[styles.thumb, barStyle]} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
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
  thumbTouchArea: {
    position: 'absolute',
    top: 0,
    end: 0,
    width: TOUCH_WIDTH,
    height: THUMB_LENGTH,
    alignItems: 'flex-end',
  },
  thumb: {
    flex: 1,
    width: THICKNESS,
    marginEnd: EDGE_MARGIN,
    borderRadius: THICKNESS / 2,
  },
});
