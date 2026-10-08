import {
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  MultiChoiceSegmentedButtonRow,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';

export interface SegmentedControlOption<T> {
  label: string;
  value: T;
  icon?: IconSource;
}

const segmentColors = (theme: ThemeColors) => ({
  activeContainerColor: theme.secondaryContainer,
  activeContentColor: theme.onSecondaryContainer,
  activeBorderColor: theme.outline,
  inactiveContainerColor: 'transparent',
  inactiveContentColor: theme.onSurface,
  inactiveBorderColor: theme.outline,
});

export interface SegmentedControlProps<T> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  theme: ThemeColors;
  modifiers?: ModifierConfig[];
  /** Show each option's icon in place of its label. */
  iconOnly?: boolean;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  theme,
  modifiers,
  iconOnly = false,
}: SegmentedControlProps<T>) {
  return (
    <SingleChoiceSegmentedButtonRow modifiers={modifiers ?? [fillMaxWidth()]}>
      {options.map(option => (
        <SegmentedButton
          key={String(option.value)}
          selected={option.value === value}
          onClick={() => onChange(option.value)}
          colors={segmentColors(theme)}
        >
          <SegmentedButton.Label>
            {iconOnly && option.icon ? (
              <AppIcon source={option.icon} size={18} label={option.label} />
            ) : (
              <AppText variant="labelLarge" maxLines={1}>
                {option.label}
              </AppText>
            )}
          </SegmentedButton.Label>
        </SegmentedButton>
      ))}
    </SingleChoiceSegmentedButtonRow>
  );
}

export function MultiSegmentedControl<T extends string | number>({
  options,
  values,
  onToggle,
  theme,
}: {
  options: readonly SegmentedControlOption<T>[];
  values: readonly T[];
  onToggle: (value: T, checked: boolean) => void;
  theme: ThemeColors;
}) {
  return (
    <MultiChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
      {options.map(option => (
        <SegmentedButton
          key={String(option.value)}
          checked={values.includes(option.value)}
          onCheckedChange={checked => onToggle(option.value, checked)}
          colors={segmentColors(theme)}
        >
          <SegmentedButton.Label>
            <AppText variant="labelLarge" maxLines={1}>
              {option.label}
            </AppText>
          </SegmentedButton.Label>
        </SegmentedButton>
      ))}
    </MultiChoiceSegmentedButtonRow>
  );
}
