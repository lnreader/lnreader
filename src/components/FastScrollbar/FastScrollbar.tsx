import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
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
import type { ThemeColors } from '@theme/types';
import type { FastScrollMetrics } from './useFastScrollMetrics';
import {
  getScrollProgress,
  isFastScrollUseful,
  progressToIndex,
} from './fastScrollMath';
import { ScrubController } from './ScrubController';

const THUMB_HEIGHT = 48;
const THUMB_WIDTH = 8;
const TOUCH_WIDTH = 32;
const LABEL_HEIGHT = 40;
const FADE_IN_MS = 120;
const FADE_OUT_MS = 250;
const HIDE_DELAY_MS = 1500;

export interface FastScrollbarProps {
  metrics: FastScrollMetrics;
  /** Total number of items, including ones not loaded yet. */
  itemCount: number;
  /** Number of items currently in the list's data. Defaults to `itemCount`. */
  loadedCount?: number;
  /** Called (at most once per frame) with the index under the thumb. */
  onScrub: (index: number) => void;
  onScrubEnd?: (index: number) => void;
  getLabel?: (index: number) => string | undefined;
  topInset?: number;
  bottomInset?: number;
  /** Only shown when the content is at least this many viewports tall. */
  minScreens?: number;
  hapticFeedback?: boolean;
}

type LabelHandle = { setText: (text: string | undefined) => void };

// Owns the label text so updates while scrubbing only re-render this Text.
const ScrubLabel = ({
  ref,
  theme,
}: {
  ref: React.Ref<LabelHandle>;
  theme: ThemeColors;
}) => {
  const [text, setText] = useState<string>();
  useImperativeHandle(ref, () => ({ setText }), []);
  if (!text) {
    return null;
  }
  return (
    <View style={[styles.label, { backgroundColor: theme.primaryContainer }]}>
      <Text
        numberOfLines={1}
        style={[styles.labelText, { color: theme.onPrimaryContainer }]}
      >
        {text}
      </Text>
    </View>
  );
};

const FastScrollbar = ({
  metrics,
  itemCount,
  loadedCount = itemCount,
  onScrub,
  onScrubEnd,
  getLabel,
  topInset = 0,
  bottomInset = 0,
  minScreens = 4,
  hapticFeedback = true,
}: FastScrollbarProps) => {
  const theme = useTheme();
  const { scrollOffset, contentLength, viewportLength } = metrics;

  const total = useSharedValue(itemCount);
  const loaded = useSharedValue(loadedCount);
  const trackHeight = useSharedValue(0);
  const opacity = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragY = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastIndex = useSharedValue(-1);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    total.set(itemCount);
    loaded.set(loadedCount);
  }, [itemCount, loadedCount, total, loaded]);

  const labelRef = useRef<LabelHandle>(null);
  const [controller] = useState(
    () =>
      new ScrubController({ onScrub, onScrubEnd, getLabel, hapticFeedback }),
  );

  useEffect(() => {
    controller.setHandlers({
      onScrub,
      onScrubEnd,
      getLabel,
      hapticFeedback,
      setLabel: text => labelRef.current?.setText(text),
    });
  }, [controller, onScrub, onScrubEnd, getLabel, hapticFeedback]);

  useEffect(() => () => controller.dispose(), [controller]);

  // Worklets must capture plain functions, not the class instance.
  const { grab, schedule, release } = controller;

  const thumbY = useDerivedValue(() => {
    if (dragging.get()) {
      return dragY.get();
    }
    const range = Math.max(0, trackHeight.get() - THUMB_HEIGHT);
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

  useAnimatedReaction(
    () => scrollOffset.get(),
    (current, previous) => {
      if (previous === null || current === previous || dragging.get()) {
        return;
      }
      if (
        !isFastScrollUseful(
          contentLength.get(),
          viewportLength.get(),
          loaded.get(),
          total.get(),
          minScreens,
        )
      ) {
        return;
      }
      opacity.set(
        withSequence(
          withTiming(1, { duration: FADE_IN_MS }),
          withDelay(HIDE_DELAY_MS, withTiming(0, { duration: FADE_OUT_MS })),
        ),
      );
    },
    [minScreens],
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
        .hitSlop({ left: 16, top: 12, bottom: 12 })
        .onBegin(() => {
          const range = Math.max(1, trackHeight.get() - THUMB_HEIGHT);
          const y = thumbY.get();
          startY.set(y);
          dragY.set(y);
          dragging.set(true);
          lastIndex.set(-1);
          opacity.set(withTiming(1, { duration: FADE_IN_MS }));
          runOnJS(grab)(progressToIndex(y / range, total.get()));
        })
        .onUpdate(event => {
          const range = Math.max(1, trackHeight.get() - THUMB_HEIGHT);
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
          opacity.set(
            withDelay(HIDE_DELAY_MS, withTiming(0, { duration: FADE_OUT_MS })),
          );
          runOnJS(release)(lastIndex.get());
        }),
    [
      dragY,
      dragging,
      grab,
      lastIndex,
      opacity,
      release,
      schedule,
      startY,
      thumbY,
      total,
      trackHeight,
    ],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      trackHeight.set(event.nativeEvent.layout.height);
    },
    [trackHeight],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: thumbY.get() }],
  }));

  // scaleX instead of width so grabbing the thumb never triggers a layout pass.
  const barStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: withTiming(dragging.get() ? 1 : 0.5, { duration: 100 }) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dragging.get() ? 1 : 0, { duration: 100 }),
    transform: [
      { translateY: thumbY.get() + (THUMB_HEIGHT - LABEL_HEIGHT) / 2 },
    ],
  }));

  return (
    <View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[styles.container, { top: topInset, bottom: bottomInset }]}
      onLayout={onLayout}
    >
      {getLabel ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.labelContainer, labelStyle]}
        >
          <ScrubLabel ref={labelRef} theme={theme} />
        </Animated.View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          testID="fast-scrollbar-thumb"
          style={[styles.thumbTouchArea, thumbStyle]}
        >
          <Animated.View
            style={[styles.thumb, { backgroundColor: theme.primary }, barStyle]}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default React.memo(FastScrollbar);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  thumbTouchArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: TOUCH_WIDTH,
    height: THUMB_HEIGHT,
    alignItems: 'flex-end',
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: THUMB_WIDTH / 2,
    marginRight: 2,
    transformOrigin: 'right',
  },
  labelContainer: {
    position: 'absolute',
    top: 0,
    right: TOUCH_WIDTH + 8,
    height: LABEL_HEIGHT,
    maxWidth: '70%',
    justifyContent: 'center',
  },
  label: {
    height: LABEL_HEIGHT,
    borderRadius: LABEL_HEIGHT / 2,
    paddingHorizontal: 16,
    justifyContent: 'center',
    elevation: 2,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
