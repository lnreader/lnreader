import {
  FilledIconButton,
  FilledTonalIconButton,
  IconButton,
  OutlinedIconButton,
} from '@expo/ui/jetpack-compose';
import { type ModifierConfig } from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined';

type Props = {
  accessibilityLabel?: string;
  name: IconSource;
  color?: string;
  size?: number;
  disabled?: boolean;
  onPress: () => void;
  variant?: IconButtonVariant;
  selected?: boolean;
  modifiers?: ModifierConfig[];
  theme: ThemeColors;
};

const IconButtonV2 = ({
  accessibilityLabel,
  name,
  color: tint,
  size = 24,
  disabled,
  onPress,
  variant = 'standard',
  selected,
  modifiers,
  theme,
}: Props) => {
  const glyph = (
    <AppIcon source={name} label={accessibilityLabel} size={size} />
  );
  const common = { onClick: onPress, enabled: !disabled, modifiers };
  const disabledContentColor = theme.onSurfaceDisabled;

  switch (variant) {
    case 'filled':
      return (
        <FilledIconButton
          {...common}
          colors={{
            containerColor: theme.primary,
            contentColor: theme.onPrimary,
            disabledContainerColor: theme.surfaceDisabled,
            disabledContentColor,
          }}
        >
          {glyph}
        </FilledIconButton>
      );
    case 'tonal':
      return (
        <FilledTonalIconButton
          {...common}
          colors={{
            containerColor: selected
              ? theme.primaryContainer
              : theme.secondaryContainer,
            contentColor: selected
              ? theme.onPrimaryContainer
              : theme.onSecondaryContainer,
            disabledContainerColor: theme.surfaceDisabled,
            disabledContentColor,
          }}
        >
          {glyph}
        </FilledTonalIconButton>
      );
    case 'outlined':
      return (
        <OutlinedIconButton
          {...common}
          colors={{
            containerColor: 'transparent',
            contentColor: tint ?? theme.onSurfaceVariant,
            disabledContentColor,
          }}
        >
          {glyph}
        </OutlinedIconButton>
      );
    default:
      return (
        <IconButton
          {...common}
          colors={{
            containerColor: 'transparent',
            contentColor:
              tint ?? (selected ? theme.primary : theme.onSurfaceVariant),
            disabledContentColor,
          }}
        >
          {glyph}
        </IconButton>
      );
  }
};

export default IconButtonV2;
