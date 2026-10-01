import { type ReactNode } from 'react';
import {
  Button as ComposeButton,
  FilledTonalButton,
  OutlinedButton,
  TextButton,
} from '@expo/ui/jetpack-compose';
import {
  padding,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';

type ButtonMode = 'text' | 'outlined' | 'contained' | 'contained-tonal';

interface ButtonProps {
  title?: string;
  children?: ReactNode;
  onPress: () => void;
  icon?: IconSource;
  mode?: ButtonMode;
  disabled?: boolean;
  textColor?: string;
  buttonColor?: string;
  modifiers?: ModifierConfig[];
}

const Button = ({
  title,
  children,
  onPress,
  icon,
  mode = 'text',
  disabled,
  textColor,
  buttonColor,
  modifiers,
}: ButtonProps) => {
  const theme = useTheme();
  const accent = textColor ?? theme.primary;
  const disabledColors = {
    disabledContainerColor: theme.surfaceDisabled,
    disabledContentColor: theme.onSurfaceDisabled,
  };
  const content = (
    <>
      {icon ? <AppIcon source={icon} size={18} /> : null}
      {title || typeof children === 'string' ? (
        <AppText
          variant="labelLarge"
          modifiers={icon ? [padding(8, 0, 0, 0)] : undefined}
        >
          {title || children}
        </AppText>
      ) : (
        children
      )}
    </>
  );
  const common = { onClick: onPress, enabled: !disabled, modifiers };

  switch (mode) {
    case 'contained-tonal':
      return (
        <FilledTonalButton
          {...common}
          colors={{
            containerColor: buttonColor ?? theme.secondaryContainer,
            contentColor: textColor ?? theme.onSecondaryContainer,
            ...disabledColors,
          }}
        >
          {content}
        </FilledTonalButton>
      );
    case 'outlined':
      return (
        <OutlinedButton
          {...common}
          colors={{
            containerColor: 'transparent',
            contentColor: accent,
            disabledContainerColor: 'transparent',
            disabledContentColor: theme.onSurfaceDisabled,
          }}
        >
          {content}
        </OutlinedButton>
      );
    default:
      return (
        <TextButton
          {...common}
          colors={{
            containerColor: 'transparent',
            contentColor: accent,
            disabledContainerColor: 'transparent',
            disabledContentColor: theme.onSurfaceDisabled,
          }}
        >
          {content}
        </TextButton>
      );
    case 'contained':
      return (
        <ComposeButton
          {...common}
          colors={{
            containerColor: buttonColor ?? theme.primary,
            contentColor: textColor ?? theme.onPrimary,
            ...disabledColors,
          }}
        >
          {content}
        </ComposeButton>
      );
  }
};

export default Button;
