import { ThemeColors } from '@theme/types';
import color from 'color';
import { useAppSettings } from '@hooks/persisted';
import { useMemo } from 'react';

const BASE_STRENGTH = 0.03;
const STATIC_BASE_STRENGTH = 0.05;
const HIGHLIGHT_STRENGTH = 0.06;
const TINT_STRENGTH = 0.02;

export const getLoadingColors = (
  theme: ThemeColors,
  disableLoadingAnimations = false,
  tintColor?: string,
) => {
  const surfaceColor = color(theme.surface);
  const foregroundColor = color(theme.onSurface);
  // Keep some foreground contrast when the accent is drawn from a dark palette.
  const blendColor = tintColor
    ? foregroundColor.mix(color(tintColor))
    : foregroundColor;
  const tintStrength = tintColor ? TINT_STRENGTH : 0;
  const backgroundStrength = disableLoadingAnimations
    ? STATIC_BASE_STRENGTH
    : BASE_STRENGTH;

  const backgroundColor = surfaceColor
    .mix(blendColor, backgroundStrength + tintStrength)
    .hex();
  const highlightColor = surfaceColor
    .mix(blendColor, HIGHLIGHT_STRENGTH + tintStrength)
    .hex();

  return [highlightColor, backgroundColor] as const;
};

const useLoadingColors = (theme: ThemeColors, tintColor?: string) => {
  const { disableLoadingAnimations } = useAppSettings();
  const colors = useMemo(
    () => getLoadingColors(theme, disableLoadingAnimations, tintColor),
    [disableLoadingAnimations, theme, tintColor],
  );

  return [...colors, disableLoadingAnimations] as const;
};

export default useLoadingColors;
