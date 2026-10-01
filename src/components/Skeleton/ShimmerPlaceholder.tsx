import { memo, useSyncExternalStore } from 'react';
import { Box } from '@expo/ui/jetpack-compose';
import {
  animated,
  background,
  clip,
  graphicsLayer,
  height as heightModifier,
  Shapes,
  tween,
  width as widthModifier,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';

const DURATION = 1000;

// One ticker for every placeholder on screen, so they pulse in step.
const listeners = new Set<() => void>();
let dimmed = false;
let timer: ReturnType<typeof setInterval> | undefined;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      dimmed = !dimmed;
      listeners.forEach(notify => notify());
    }, DURATION);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
};
const noopSubscribe = () => () => {};
const getDimmed = () => dimmed;
const getStatic = () => false;

/** A modifier fading placeholders in and out; static when `stopAutoRun`. */
export const useShimmerModifier = (stopAutoRun = false) => {
  const isDimmed = useSyncExternalStore(
    stopAutoRun ? noopSubscribe : subscribe,
    stopAutoRun ? getStatic : getDimmed,
  );
  return graphicsLayer({
    alpha: animated(isDimmed ? 0.4 : 1, tween({ durationMillis: DURATION })),
  });
};

export interface ShimmerPlaceholderProps {
  height: number;
  width?: number;
  /** Only the first color is used: the placeholder pulses instead of sweeping. */
  shimmerColors?: string[];
  stopAutoRun?: boolean;
  visible?: boolean;
  corner?: number;
  modifiers?: ModifierConfig[];
}

const ShimmerPlaceholder = memo(
  ({
    height,
    width,
    shimmerColors,
    stopAutoRun,
    visible = false,
    corner = 4,
    modifiers = [],
  }: ShimmerPlaceholderProps) => {
    const shimmer = useShimmerModifier(stopAutoRun || visible);
    if (visible) {
      return null;
    }
    return (
      <Box
        modifiers={[
          ...modifiers,
          ...(width === undefined ? [] : [widthModifier(width)]),
          heightModifier(height),
          shimmer,
          clip(Shapes.RoundedCorner(corner)),
          background(shimmerColors?.[0] ?? '#8882'),
        ]}
      />
    );
  },
);

export default ShimmerPlaceholder;
