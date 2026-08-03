import {
  getExpoHostThemeProps,
  getSegmentedButtonColors,
  getCheckboxColors,
  getSwitchColors,
  getButtonColors,
  getAssistChipColors,
  getFilterChipColors,
  getFilterChipBorder,
} from '../theme';
import type { ThemeColors } from '@theme/types';

const baseTheme = {
  isDark: false,
  primary: 'rgb(0, 87, 206)',
  onPrimary: 'rgb(255, 255, 255)',
  secondaryContainer: 'rgb(220, 226, 249)',
  onSecondaryContainer: 'rgb(21, 27, 44)',
  onSurface: 'rgb(27, 27, 31)',
  onSurfaceVariant: 'rgb(68, 70, 79)',
  outline: 'rgb(117, 119, 128)',
  surfaceVariant: 'rgb(225, 226, 236)',
  surfaceContainerLow: 'rgb(245, 243, 247)',
  surface: 'rgb(254, 251, 255)',
  surfaceDisabled: 'rgba(27, 27, 31, 0.12)',
  onSurfaceDisabled: 'rgba(27, 27, 31, 0.38)',
} as ThemeColors;

describe('getExpoHostThemeProps', () => {
  it('maps a light theme to a light colorScheme and its primary as seedColor', () => {
    expect(getExpoHostThemeProps(baseTheme)).toEqual({
      colorScheme: 'light',
      seedColor: baseTheme.primary,
    });
  });

  it('maps a dark theme to a dark colorScheme', () => {
    expect(
      getExpoHostThemeProps({ ...baseTheme, isDark: true } as ThemeColors),
    ).toEqual({
      colorScheme: 'dark',
      seedColor: baseTheme.primary,
    });
  });

  it('reflects custom theme accent colors so non-default themes stay in seed', () => {
    const customTheme = {
      ...baseTheme,
      primary: 'rgb(250, 128, 114)',
    } as ThemeColors;

    expect(getExpoHostThemeProps(customTheme).seedColor).toBe(
      'rgb(250, 128, 114)',
    );
  });
});

describe('getSegmentedButtonColors', () => {
  it('maps the selected segment to secondaryContainer/onSecondaryContainer', () => {
    const colors = getSegmentedButtonColors(baseTheme);

    expect(colors.activeContainerColor).toBe(baseTheme.secondaryContainer);
    expect(colors.activeContentColor).toBe(baseTheme.onSecondaryContainer);
  });

  it('maps the unselected segment to a transparent container and onSurface text', () => {
    const colors = getSegmentedButtonColors(baseTheme);

    expect(colors.inactiveContainerColor).toBe('transparent');
    expect(colors.inactiveContentColor).toBe(baseTheme.onSurface);
  });

  it('uses the theme outline color for borders in every state', () => {
    const colors = getSegmentedButtonColors(baseTheme);

    expect(colors.activeBorderColor).toBe(baseTheme.outline);
    expect(colors.inactiveBorderColor).toBe(baseTheme.outline);
    expect(colors.disabledActiveBorderColor).toBe(baseTheme.outline);
    expect(colors.disabledInactiveBorderColor).toBe(baseTheme.outline);
  });

  it('maps disabled states to surfaceDisabled/onSurfaceDisabled', () => {
    const colors = getSegmentedButtonColors(baseTheme);

    expect(colors.disabledActiveContainerColor).toBe(baseTheme.surfaceDisabled);
    expect(colors.disabledActiveContentColor).toBe(baseTheme.onSurfaceDisabled);
    expect(colors.disabledInactiveContentColor).toBe(
      baseTheme.onSurfaceDisabled,
    );
  });
});

describe('getCheckboxColors', () => {
  it('maps checked/unchecked colors and the checkmark contrast color', () => {
    expect(getCheckboxColors(baseTheme)).toEqual({
      checkedColor: baseTheme.primary,
      uncheckedColor: baseTheme.onSurfaceVariant,
      disabledCheckedColor: baseTheme.onSurfaceVariant,
      disabledUncheckedColor: baseTheme.onSurfaceVariant,
      disabledIndeterminateColor: baseTheme.onSurfaceVariant,
      checkmarkColor: baseTheme.onPrimary,
    });
  });
});

describe('getSwitchColors', () => {
  it('maps the checked track/thumb to primary/onPrimary', () => {
    const colors = getSwitchColors(baseTheme);

    expect(colors.checkedTrackColor).toBe(baseTheme.primary);
    expect(colors.checkedThumbColor).toBe(baseTheme.onPrimary);
  });

  it('maps the unchecked track/thumb to surfaceVariant/outline', () => {
    const colors = getSwitchColors(baseTheme);

    expect(colors.uncheckedTrackColor).toBe(baseTheme.surfaceVariant);
    expect(colors.uncheckedThumbColor).toBe(baseTheme.outline);
  });
});

describe('getButtonColors', () => {
  it('maps contained to primary/onPrimary', () => {
    expect(getButtonColors(baseTheme, 'contained')).toMatchObject({
      containerColor: baseTheme.primary,
      contentColor: baseTheme.onPrimary,
    });
  });

  it('maps contained-tonal to secondaryContainer/onSecondaryContainer', () => {
    expect(getButtonColors(baseTheme, 'contained-tonal')).toMatchObject({
      containerColor: baseTheme.secondaryContainer,
      contentColor: baseTheme.onSecondaryContainer,
    });
  });

  it('maps outlined and text to a transparent container with primary content', () => {
    expect(getButtonColors(baseTheme, 'outlined')).toMatchObject({
      containerColor: 'transparent',
      contentColor: baseTheme.primary,
    });
    expect(getButtonColors(baseTheme, 'text')).toMatchObject({
      containerColor: 'transparent',
      contentColor: baseTheme.primary,
    });
  });

  it('maps disabled colors for every variant', () => {
    expect(getButtonColors(baseTheme, 'contained')).toMatchObject({
      disabledContainerColor: baseTheme.surfaceDisabled,
      disabledContentColor: baseTheme.onSurfaceDisabled,
    });
  });
});

describe('getAssistChipColors', () => {
  it('maps the container to secondaryContainer/onSecondaryContainer', () => {
    expect(getAssistChipColors(baseTheme)).toEqual({
      containerColor: baseTheme.secondaryContainer,
      labelColor: baseTheme.onSecondaryContainer,
    });
  });
});

describe('getFilterChipColors and getFilterChipBorder', () => {
  it('maps unselected to a transparent container with an outline border', () => {
    expect(getFilterChipColors(baseTheme)).toMatchObject({
      containerColor: 'transparent',
      labelColor: baseTheme.onSurfaceVariant,
    });
    expect(getFilterChipBorder(baseTheme)).toEqual({
      width: 1,
      color: baseTheme.outline,
    });
  });

  it('maps selected to secondaryContainer/onSecondaryContainer', () => {
    expect(getFilterChipColors(baseTheme)).toMatchObject({
      selectedContainerColor: baseTheme.secondaryContainer,
      selectedLabelColor: baseTheme.onSecondaryContainer,
    });
  });
});
