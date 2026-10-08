import { useRef, useState } from 'react';
import {
  Box,
  Slider as ComposeSlider,
  VerticalSlider,
} from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxWidth,
  Shapes,
  size,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';
import Color from 'color';
import { useTheme } from '@hooks/persisted/useTheme';

/** Stops help with a few values; beyond that they are just noise. */
const MAX_STOPS = 12;

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showStops?: boolean;
  activeTrackColor?: string;
  inactiveTrackColor?: string;
  handleColor?: string;
  /** A shorter line thumb than Material's, for sliders in a tight container. */
  thumbLength?: number;
  /** Top to bottom, as Material's `VerticalSlider`. */
  vertical?: boolean;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  modifiers?: ModifierConfig[];
}

const Slider = ({
  value,
  min = 0,
  max = 1,
  step,
  disabled = false,
  showStops = false,
  activeTrackColor,
  inactiveTrackColor,
  handleColor,
  thumbLength,
  vertical = false,
  onValueChange,
  onSlidingComplete,
  modifiers,
}: SliderProps) => {
  const theme = useTheme();
  // Some themes (Midnight Dusk) make the secondary container the primary
  // colour, which would hide where the track ends.
  const tinted =
    Color(theme.secondaryContainer).hex() !== Color(theme.primary).hex();
  const inactiveTrack = tinted
    ? theme.secondaryContainer
    : theme.surfaceContainerHighest;
  const inactiveTick = tinted ? theme.onSecondaryContainer : theme.onSurface;
  const [dragValue, setDragValue] = useState<number | null>(null);
  // The finish event can arrive before React re-renders with the last drag value.
  const latest = useRef<number | null>(null);
  const snap = (next: number) =>
    step
      ? // Rounded again so 0.1 steps do not accumulate float noise.
        Math.round((Math.round((next - min) / step) * step + min) * 1e4) / 1e4
      : next;
  const stops = step ? Math.max(0, Math.round((max - min) / step) - 1) : 0;
  const SliderView = vertical ? VerticalSlider : ComposeSlider;

  return (
    <SliderView
      value={dragValue ?? value}
      min={min}
      max={max}
      steps={showStops && stops <= MAX_STOPS ? stops : 0}
      enabled={!disabled}
      onValueChange={next => {
        const snapped = snap(next);
        if (snapped === latest.current) {
          return;
        }
        latest.current = snapped;
        setDragValue(snapped);
        onValueChange?.(snapped);
      }}
      onValueChangeFinished={() => {
        if (latest.current !== null) {
          onSlidingComplete?.(latest.current);
        }
        latest.current = null;
        setDragValue(null);
      }}
      colors={{
        thumbColor: handleColor ?? theme.primary,
        activeTrackColor: activeTrackColor ?? theme.primary,
        inactiveTrackColor: inactiveTrackColor ?? inactiveTrack,
        activeTickColor: theme.onPrimary,
        inactiveTickColor: inactiveTick,
      }}
      modifiers={modifiers ?? [fillMaxWidth()]}
    >
      {thumbLength ? (
        <ComposeSlider.Thumb>
          <Box
            modifiers={[
              vertical ? size(thumbLength, 4) : size(4, thumbLength),
              clip(Shapes.RoundedCorner(2)),
              background(
                disabled
                  ? theme.onSurfaceDisabled
                  : handleColor ?? theme.primary,
              ),
            ]}
          />
        </ComposeSlider.Thumb>
      ) : null}
    </SliderView>
  );
};

export default Slider;
