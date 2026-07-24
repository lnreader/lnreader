import React, { useCallback, useMemo, useState } from 'react';
import {
  AccessibilityActionEvent,
  I18nManager,
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import Color from 'color';

import { useTheme } from '@hooks/persisted';

const TOUCH_TARGET_HEIGHT = 48;
const MAX_RENDERED_STOPS = 100;
const HANDLE_WIDTH = 4;
const PRESSED_HANDLE_WIDTH = 2;
const HANDLE_TRACK_GAP = 6;
const INSIDE_CORNER_RADIUS = 2;
const STOP_SIZE = 4;

export type SliderSize = 'xs' | 's' | 'm' | 'l' | 'xl';

const SIZE_TOKENS: Record<
  SliderSize,
  { trackHeight: number; trackRadius: number; handleHeight: number }
> = {
  xs: { trackHeight: 16, trackRadius: 8, handleHeight: 44 },
  s: { trackHeight: 24, trackRadius: 8, handleHeight: 44 },
  m: { trackHeight: 40, trackRadius: 12, handleHeight: 52 },
  l: { trackHeight: 56, trackRadius: 16, handleHeight: 68 },
  xl: { trackHeight: 96, trackRadius: 28, handleHeight: 108 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const decimalPlaces = (value: number) => {
  const [, decimals = ''] = value.toString().split('.');
  return decimals.length;
};

export interface SliderProps
  extends Omit<
    ViewProps,
    | 'accessibilityActions'
    | 'accessibilityRole'
    | 'accessibilityState'
    | 'accessibilityValue'
    | 'onAccessibilityAction'
    | 'onLayout'
    | 'style'
  > {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  size?: SliderSize;
  showStops?: boolean;
  showValueIndicator?: boolean;
  formatValue?: (value: number) => string;
  activeTrackColor?: string;
  inactiveTrackColor?: string;
  handleColor?: string;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}

const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 1,
  step,
  disabled = false,
  size = 'xs',
  showStops = false,
  showValueIndicator = false,
  formatValue = String,
  activeTrackColor,
  inactiveTrackColor,
  handleColor,
  onValueChange,
  onSlidingComplete,
  style,
  testID = 'slider',
  ...viewProps
}) => {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const sizeTokens = SIZE_TOKENS[size];
  const containerHeight = Math.max(
    TOUCH_TARGET_HEIGHT,
    sizeTokens.handleHeight,
  );
  const centerY = containerHeight / 2;
  const trackTop = centerY - sizeTokens.trackHeight / 2;
  const handleTop = centerY - sizeTokens.handleHeight / 2;
  const stopTop = centerY - STOP_SIZE / 2;

  const safeMax = max > min ? max : min + 1;
  const span = safeMax - min;
  const boundedValue = clamp(value, min, safeMax);
  const displayedValue =
    dragValue === null ? boundedValue : clamp(dragValue, min, safeMax);
  const fraction = (displayedValue - min) / span;
  const isDiscrete = Boolean(step && step > 0);
  const isEndpoint = fraction === 0 || fraction === 1;
  const logicalValuePosition =
    isDiscrete && !isEndpoint
      ? sizeTokens.trackRadius + (width - sizeTokens.trackRadius * 2) * fraction
      : width * fraction;
  const handlePosition = clamp(
    I18nManager.isRTL ? width - logicalValuePosition : logicalValuePosition,
    HANDLE_WIDTH / 2,
    Math.max(width - HANDLE_WIDTH / 2, HANDLE_WIDTH / 2),
  );
  const gapFromHandleCenter = HANDLE_WIDTH / 2 + HANDLE_TRACK_GAP;
  const beforeHandleWidth = Math.max(handlePosition - gapFromHandleCenter, 0);
  const afterHandleStart = Math.min(
    handlePosition + gapFromHandleCenter,
    width,
  );
  const afterHandleWidth = Math.max(width - afterHandleStart, 0);
  const resolvedActiveColor = activeTrackColor ?? theme.primary;
  const resolvedInactiveColor = inactiveTrackColor ?? theme.secondaryContainer;
  const resolvedHandleColor = handleColor ?? theme.primary;
  const disabledActiveColor = Color(theme.onSurface).alpha(0.38).string();
  const disabledInactiveColor = Color(theme.onSurface).alpha(0.12).string();

  const normalizeValue = useCallback(
    (nextValue: number) => {
      const steppedValue = step
        ? min + Math.round((nextValue - min) / step) * step
        : nextValue;
      const precision = step ? decimalPlaces(step) : 6;
      return Number(clamp(steppedValue, min, safeMax).toFixed(precision));
    },
    [min, safeMax, step],
  );

  const updateFromPosition = useCallback(
    (locationX: number) => {
      if (disabled || width <= HANDLE_WIDTH) return displayedValue;

      let nextFraction = clamp(
        (locationX - HANDLE_WIDTH / 2) / (width - HANDLE_WIDTH),
        0,
        1,
      );
      if (I18nManager.isRTL) nextFraction = 1 - nextFraction;

      const nextValue = normalizeValue(min + nextFraction * span);
      setDragValue(nextValue);
      onValueChange?.(nextValue);
      return nextValue;
    },
    [disabled, displayedValue, min, normalizeValue, onValueChange, span, width],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: event => {
          setIsActive(true);
          updateFromPosition(event.nativeEvent.locationX);
        },
        onPanResponderMove: event =>
          updateFromPosition(event.nativeEvent.locationX),
        onPanResponderRelease: event => {
          const completedValue = updateFromPosition(
            event.nativeEvent.locationX,
          );
          setIsActive(false);
          setDragValue(null);
          onSlidingComplete?.(completedValue);
        },
        onPanResponderTerminate: () => {
          setIsActive(false);
          setDragValue(null);
          onSlidingComplete?.(displayedValue);
        },
      }),
    [disabled, displayedValue, onSlidingComplete, updateFromPosition],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const changeBy = useCallback(
    (amount: number) => {
      if (disabled) return;
      const nextValue = normalizeValue(boundedValue + amount);
      onValueChange?.(nextValue);
      onSlidingComplete?.(nextValue);
    },
    [boundedValue, disabled, normalizeValue, onSlidingComplete, onValueChange],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const change = step ?? span / 20;
      if (event.nativeEvent.actionName === 'increment') changeBy(change);
      if (event.nativeEvent.actionName === 'decrement') changeBy(-change);
    },
    [changeBy, span, step],
  );

  const stops = useMemo(() => {
    if (!showStops || !step || step <= 0) return [1];
    const count = Math.round(span / step);
    if (count < 1 || count > MAX_RENDERED_STOPS) return [1];
    return Array.from({ length: count + 1 }, (_, index) => index / count);
  }, [showStops, span, step]);

  return (
    <View
      {...viewProps}
      {...panResponder.panHandlers}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityActions={[
        { name: 'increment', label: 'Increase' },
        { name: 'decrement', label: 'Decrease' },
      ]}
      accessibilityState={{ disabled }}
      accessibilityValue={{
        min,
        max: safeMax,
        now: displayedValue,
        text: formatValue(displayedValue),
      }}
      onAccessibilityAction={handleAccessibilityAction}
      onLayout={handleLayout}
      style={[styles.container, { height: containerHeight }, style]}
    >
      {showValueIndicator && isActive ? (
        <View
          pointerEvents="none"
          style={[
            styles.valueIndicator,
            {
              backgroundColor: theme.inverseSurface,
              bottom: centerY + sizeTokens.handleHeight / 2 + 12,
              left: handlePosition,
            },
          ]}
        >
          <Text
            style={[
              styles.valueIndicatorText,
              { color: theme.inverseOnSurface },
            ]}
          >
            {formatValue(displayedValue)}
          </Text>
        </View>
      ) : null}

      <>
        <View
          pointerEvents="none"
          testID={`${testID}-active-track`}
          style={[
            styles.trackSegment,
            {
              backgroundColor: disabled
                ? disabledActiveColor
                : resolvedActiveColor,
              borderTopLeftRadius: I18nManager.isRTL
                ? INSIDE_CORNER_RADIUS
                : sizeTokens.trackRadius,
              borderBottomLeftRadius: I18nManager.isRTL
                ? INSIDE_CORNER_RADIUS
                : sizeTokens.trackRadius,
              borderTopRightRadius: I18nManager.isRTL
                ? sizeTokens.trackRadius
                : INSIDE_CORNER_RADIUS,
              borderBottomRightRadius: I18nManager.isRTL
                ? sizeTokens.trackRadius
                : INSIDE_CORNER_RADIUS,
              height: sizeTokens.trackHeight,
              left: I18nManager.isRTL ? afterHandleStart : 0,
              top: trackTop,
              width: I18nManager.isRTL ? afterHandleWidth : beforeHandleWidth,
            },
          ]}
        />
        <View
          pointerEvents="none"
          testID={`${testID}-inactive-track`}
          style={[
            styles.trackSegment,
            {
              backgroundColor: disabled
                ? disabledInactiveColor
                : resolvedInactiveColor,
              borderTopLeftRadius: I18nManager.isRTL
                ? sizeTokens.trackRadius
                : INSIDE_CORNER_RADIUS,
              borderBottomLeftRadius: I18nManager.isRTL
                ? sizeTokens.trackRadius
                : INSIDE_CORNER_RADIUS,
              borderTopRightRadius: I18nManager.isRTL
                ? INSIDE_CORNER_RADIUS
                : sizeTokens.trackRadius,
              borderBottomRightRadius: I18nManager.isRTL
                ? INSIDE_CORNER_RADIUS
                : sizeTokens.trackRadius,
              height: sizeTokens.trackHeight,
              left: I18nManager.isRTL ? 0 : afterHandleStart,
              top: trackTop,
              width: I18nManager.isRTL ? beforeHandleWidth : afterHandleWidth,
            },
          ]}
        />
        {stops.map(stop => {
          const stopPosition =
            sizeTokens.trackRadius +
            (width - sizeTokens.trackRadius * 2) *
              (I18nManager.isRTL ? 1 - stop : stop);
          const isInHandleGap =
            Math.abs(stopPosition - handlePosition) <= gapFromHandleCenter;
          if (isInHandleGap) return null;

          const isActiveStop = stop <= fraction;
          return (
            <View
              key={stop}
              pointerEvents="none"
              style={[
                styles.stop,
                {
                  backgroundColor: disabled
                    ? disabledActiveColor
                    : showStops
                    ? isActiveStop
                      ? theme.onPrimary
                      : theme.onSecondaryContainer
                    : resolvedActiveColor,
                  left: stopPosition,
                  top: stopTop,
                },
              ]}
            />
          );
        })}
      </>

      <View
        pointerEvents="none"
        testID={`${testID}-handle`}
        style={[
          styles.handle,
          {
            backgroundColor: disabled
              ? disabledActiveColor
              : resolvedHandleColor,
            borderRadius: HANDLE_WIDTH / 2,
            height: sizeTokens.handleHeight,
            left: handlePosition,
            marginLeft: -(isActive ? PRESSED_HANDLE_WIDTH : HANDLE_WIDTH) / 2,
            top: handleTop,
            width: isActive ? PRESSED_HANDLE_WIDTH : HANDLE_WIDTH,
          },
        ]}
      />
    </View>
  );
};

export default React.memo(Slider);

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    position: 'relative',
  },
  handle: {
    position: 'absolute',
  },
  stop: {
    borderRadius: STOP_SIZE / 2,
    height: STOP_SIZE,
    marginLeft: -STOP_SIZE / 2,
    position: 'absolute',
    width: STOP_SIZE,
  },
  trackSegment: {
    position: 'absolute',
  },
  valueIndicator: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    transform: [{ translateX: -24 }],
    width: 48,
  },
  valueIndicatorText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
