import { Switch as ComposeSwitch } from '@expo/ui/jetpack-compose';
import { useTheme } from '@hooks/persisted/useTheme';

const Switch = ({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) => {
  const theme = useTheme();
  return (
    <ComposeSwitch
      value={value}
      enabled={!disabled}
      onCheckedChange={onValueChange}
      colors={{
        checkedThumbColor: theme.onPrimary,
        checkedTrackColor: theme.primary,
        checkedBorderColor: theme.primary,
        uncheckedThumbColor: theme.outline,
        uncheckedTrackColor: theme.surfaceContainerHighest,
        uncheckedBorderColor: theme.outline,
        disabledCheckedTrackColor: theme.surfaceDisabled,
        disabledUncheckedBorderColor: theme.surfaceDisabled,
      }}
    />
  );
};

export default Switch;
