import { FilterChip, InputChip, AssistChip } from '@expo/ui/jetpack-compose';
import { ThemeColors } from '@theme/types';
import CheckIcon from '@expo/material-symbols/check.xml';
import CloseIcon from '@expo/material-symbols/close.xml';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';

export interface ChipProps {
  label: string;
  onPress?: () => void;
  icon?: IconSource;
  selected?: boolean;
  kind?: 'filter' | 'assist' | 'input';
  onRemove?: () => void;
  disabled?: boolean;
  selectedIcon?: IconSource;
  tone?: 'default' | 'error';
  theme: ThemeColors;
}

const Chip = ({
  label,
  onPress,
  icon,
  selected = false,
  kind = 'filter',
  disabled,
  selectedIcon = CheckIcon,
  tone = 'default',
  theme,
}: ChipProps) => {
  const text = <AppText variant="labelLarge">{label}</AppText>;

  if (kind === 'assist') {
    return (
      <AssistChip
        onClick={onPress}
        enabled={!disabled}
        colors={{
          containerColor: 'transparent',
          labelColor: theme.onSurface,
          leadingIconContentColor: theme.primary,
        }}
        border={{ color: theme.outlineVariant }}
      >
        <AssistChip.Label>{text}</AssistChip.Label>
        {icon ? (
          <AssistChip.LeadingIcon>
            <AppIcon source={icon} size={18} />
          </AssistChip.LeadingIcon>
        ) : null}
      </AssistChip>
    );
  }

  if (kind === 'input') {
    return (
      <InputChip
        onClick={onPress}
        enabled={!disabled}
        selected={selected}
        colors={{
          containerColor: 'transparent',
          labelColor: theme.onSurfaceVariant,
          trailingIconColor: theme.onSurfaceVariant,
          selectedContainerColor: theme.secondaryContainer,
          selectedLabelColor: theme.onSecondaryContainer,
        }}
        border={{ color: theme.outlineVariant }}
      >
        <InputChip.Label>{text}</InputChip.Label>
        <InputChip.TrailingIcon>
          <AppIcon source={CloseIcon} size={18} />
        </InputChip.TrailingIcon>
      </InputChip>
    );
  }

  return (
    <FilterChip
      selected={selected}
      onClick={onPress}
      enabled={!disabled}
      colors={{
        containerColor: 'transparent',
        labelColor: theme.onSurfaceVariant,
        iconColor: theme.onSurfaceVariant,
        selectedContainerColor:
          tone === 'error' ? theme.errorContainer : theme.secondaryContainer,
        selectedLabelColor:
          tone === 'error'
            ? theme.onErrorContainer
            : theme.onSecondaryContainer,
        selectedLeadingIconColor:
          tone === 'error'
            ? theme.onErrorContainer
            : theme.onSecondaryContainer,
      }}
      border={selected ? { width: 0 } : { color: theme.outlineVariant }}
    >
      <FilterChip.Label>{text}</FilterChip.Label>
      {selected || icon ? (
        <FilterChip.LeadingIcon>
          <AppIcon
            source={selected ? selectedIcon : icon ?? CheckIcon}
            size={18}
          />
        </FilterChip.LeadingIcon>
      ) : null}
    </FilterChip>
  );
};

export default Chip;
