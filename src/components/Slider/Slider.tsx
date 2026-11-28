import React, { useCallback, useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Host, Slider as NativeSlider } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics } from '@expo/ui/jetpack-compose/modifiers';
import Color from 'color';

import { useTheme } from '@hooks/persisted';

const TRANSPARENT = 'transparent';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const decimalPlaces = (value: number) => {
  const [, decimals = ''] = value.toString().split('.');
  return decimals.length;
};

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showStops?: boolean;
  accessibilityLabel?: string;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 1,
  step,
  disabled = false,
  showStops = false,
  accessibilityLabel,
  onValueChange,
  onSlidingComplete,
  style,
  testID = 'slider',
}) => {
  const theme = useTheme();
  const safeMax = max > min ? max : min + 1;
  const boundedValue = clamp(value, min, safeMax);
  const lastValue = useRef(boundedValue);

  // Compose counts the stops between the endpoints, not the intervals.
  const steps =
    step && step > 0 ? Math.max(Math.round((safeMax - min) / step) - 1, 0) : 0;

  // Compose reports floats (e.g. 1.4000001), so snap them back onto the step grid.
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

  const handleValueChange = useCallback(
    (nextValue: number) => {
      const normalized = normalizeValue(nextValue);
      if (normalized === lastValue.current) return;
      lastValue.current = normalized;
      onValueChange?.(normalized);
    },
    [normalizeValue, onValueChange],
  );

  const handleValueChangeFinished = useCallback(() => {
    onSlidingComplete?.(lastValue.current);
  }, [onSlidingComplete]);

  useEffect(() => {
    lastValue.current = boundedValue;
  }, [boundedValue]);

  const disabledActiveColor = Color(theme.onSurface).alpha(0.38).string();
  const disabledInactiveColor = Color(theme.onSurface).alpha(0.12).string();

  return (
    <View testID={testID} style={style}>
      <Host matchContents={{ vertical: true }}>
        <NativeSlider
          value={boundedValue}
          min={min}
          max={safeMax}
          steps={steps}
          enabled={!disabled}
          colors={{
            thumbColor: theme.primary,
            activeTrackColor: theme.primary,
            inactiveTrackColor: theme.secondaryContainer,
            activeTickColor: showStops ? theme.onPrimary : TRANSPARENT,
            inactiveTickColor: showStops
              ? theme.onSecondaryContainer
              : TRANSPARENT,
            disabledThumbColor: disabledActiveColor,
            disabledActiveTrackColor: disabledActiveColor,
            disabledInactiveTrackColor: disabledInactiveColor,
            disabledActiveTickColor: showStops
              ? disabledInactiveColor
              : TRANSPARENT,
            disabledInactiveTickColor: showStops
              ? disabledActiveColor
              : TRANSPARENT,
          }}
          modifiers={[
            fillMaxWidth(),
            ...(accessibilityLabel
              ? [semantics({ contentDescription: accessibilityLabel })]
              : []),
          ]}
          onValueChange={handleValueChange}
          onValueChangeFinished={handleValueChangeFinished}
        />
      </Host>
    </View>
  );
};

export default React.memo(Slider);
