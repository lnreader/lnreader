import { type ColorSchemeName, type ColorValue } from 'react-native';
import type {
  ButtonColors,
  CheckboxColors,
  ChipBorder,
  FilterChipColors,
  AssistChipColors,
  SegmentedButtonColors,
  SwitchColors,
} from '@expo/ui/jetpack-compose';
import { ThemeColors } from '@theme/types';

export interface ExpoHostThemeProps {
  colorScheme: ColorSchemeName;
  seedColor: ColorValue;
}

/**
 * Maps an LNReader theme to the Host props that seed Compose's Material You
 * palette. `seedColor` keeps the generated palette in the theme's hue even on
 * pre-Android-12 devices where dynamic color isn't otherwise available.
 * Components that need exact parity with LNReader's custom themes (e.g.
 * catppuccin, tako) should still pass explicit colors rather than relying on
 * the seed-generated palette alone.
 */
export function getExpoHostThemeProps(theme: ThemeColors): ExpoHostThemeProps {
  return {
    colorScheme: theme.isDark ? 'dark' : 'light',
    seedColor: theme.primary,
  };
}

/**
 * Maps LNReader's segmented-control color roles onto Compose's
 * `SegmentedButtonColors`, mirroring the previous RN implementation
 * (`secondaryContainer`/`onSecondaryContainer` for the selected segment).
 */
export function getSegmentedButtonColors(
  theme: ThemeColors,
): SegmentedButtonColors {
  return {
    activeContainerColor: theme.secondaryContainer,
    activeContentColor: theme.onSecondaryContainer,
    activeBorderColor: theme.outline,
    inactiveContainerColor: 'transparent',
    inactiveContentColor: theme.onSurface,
    inactiveBorderColor: theme.outline,
    disabledActiveContainerColor: theme.surfaceDisabled,
    disabledActiveContentColor: theme.onSurfaceDisabled,
    disabledActiveBorderColor: theme.outline,
    disabledInactiveContainerColor: 'transparent',
    disabledInactiveContentColor: theme.onSurfaceDisabled,
    disabledInactiveBorderColor: theme.outline,
  };
}

/**
 * Maps LNReader's checkbox color roles onto Compose's tri-state `CheckboxColors`.
 * Mirrors the previous Paper Checkbox usage, including its choice of
 * `onSurfaceVariant` (rather than `onSurfaceDisabled`) for the disabled state.
 */
export function getCheckboxColors(theme: ThemeColors): CheckboxColors {
  return {
    checkedColor: theme.primary,
    uncheckedColor: theme.onSurfaceVariant,
    disabledCheckedColor: theme.onSurfaceVariant,
    disabledUncheckedColor: theme.onSurfaceVariant,
    disabledIndeterminateColor: theme.onSurfaceVariant,
    checkmarkColor: theme.onPrimary,
  };
}

/**
 * Maps LNReader's switch color roles onto Compose's `SwitchColors`, mirroring
 * the previous Reanimated-based Switch (primary/onPrimary track+thumb when on,
 * surfaceVariant/outline when off).
 */
export function getSwitchColors(theme: ThemeColors): SwitchColors {
  return {
    checkedTrackColor: theme.primary,
    checkedThumbColor: theme.onPrimary,
    checkedBorderColor: theme.primary,
    uncheckedTrackColor: theme.surfaceVariant,
    uncheckedThumbColor: theme.outline,
    uncheckedBorderColor: theme.outline,
    disabledCheckedTrackColor: theme.onSurfaceDisabled,
    disabledCheckedThumbColor: theme.surfaceDisabled,
    disabledUncheckedTrackColor: theme.surfaceDisabled,
    disabledUncheckedThumbColor: theme.onSurfaceDisabled,
  };
}

export type ButtonVariant =
  | 'contained'
  | 'contained-tonal'
  | 'outlined'
  | 'elevated'
  | 'text';

/**
 * Maps LNReader's Button `mode` values onto Compose `ButtonColors`, mirroring
 * Paper's Button color roles for each mode.
 */
export function getButtonColors(
  theme: ThemeColors,
  variant: ButtonVariant,
): ButtonColors {
  const disabled = {
    disabledContainerColor: theme.surfaceDisabled,
    disabledContentColor: theme.onSurfaceDisabled,
  };

  switch (variant) {
    case 'contained':
      return {
        containerColor: theme.primary,
        contentColor: theme.onPrimary,
        ...disabled,
      };
    case 'contained-tonal':
      return {
        containerColor: theme.secondaryContainer,
        contentColor: theme.onSecondaryContainer,
        ...disabled,
      };
    case 'elevated':
      return {
        containerColor: theme.surfaceContainerLow ?? theme.surface,
        contentColor: theme.primary,
        ...disabled,
      };
    case 'outlined':
    case 'text':
    default:
      return {
        containerColor: 'transparent',
        contentColor: theme.primary,
        ...disabled,
      };
  }
}

/**
 * Maps LNReader's non-selectable Chip onto Compose's `AssistChipColors`,
 * mirroring the previous secondaryContainer/onSecondaryContainer background.
 */
export function getAssistChipColors(theme: ThemeColors): AssistChipColors {
  return {
    containerColor: theme.secondaryContainer,
    labelColor: theme.onSecondaryContainer,
  };
}

/**
 * Maps LNReader's SelectableChip onto Compose's `FilterChipColors`. Material
 * 3's FilterChip already shows an outline when unselected and a filled
 * container when selected, which matches the previous Paper Chip's
 * flat/outlined distinction without needing a separate mode switch.
 */
export function getFilterChipColors(theme: ThemeColors): FilterChipColors {
  return {
    containerColor: 'transparent',
    labelColor: theme.onSurfaceVariant,
    selectedContainerColor: theme.secondaryContainer,
    selectedLabelColor: theme.onSecondaryContainer,
  };
}

export function getFilterChipBorder(theme: ThemeColors): ChipBorder {
  return {
    width: 1,
    color: theme.outline,
  };
}
