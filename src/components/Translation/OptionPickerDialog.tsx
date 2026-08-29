import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Dialog } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

export interface TranslationOption {
  key: string;
  label: string;
}

interface OptionPickerDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  options: TranslationOption[];
  current?: string;
  onSelect: (key: string) => void;
}

/**
 * Dialog listing selectable options (providers, languages, prompts, parallel
 * modes) with a check mark on the active entry.
 */
const OptionPickerDialog: React.FC<OptionPickerDialogProps> = ({
  visible,
  onDismiss,
  title,
  options,
  current,
  onSelect,
}) => {
  const theme = useTheme();

  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
      </Dialog.Header>
      <Dialog.ScrollArea>
        {options.map(option => {
          const active = option.key === current;
          return (
            <Pressable
              key={option.key}
              style={[
                styles.option,
                active && { backgroundColor: theme.secondaryContainer },
              ]}
              android_ripple={{ color: theme.rippleColor }}
              onPress={() => {
                onSelect(option.key);
                onDismiss();
              }}
            >
              <Text style={[styles.label, { color: theme.onSurface }]}>
                {option.label}
              </Text>
              {active ? (
                <Text style={[styles.check, { color: theme.primary }]}>✓</Text>
              ) : null}
            </Pressable>
          );
        })}
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default React.memo(OptionPickerDialog);

const styles = StyleSheet.create({
  option: {
    alignItems: 'center',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    padding: 12,
  },
  label: {
    fontSize: 16,
    flex: 1,
  },
  check: {
    fontSize: 16,
  },
});
