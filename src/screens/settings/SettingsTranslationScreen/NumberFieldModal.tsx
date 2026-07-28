import { useState } from 'react';
import { TextInput } from 'react-native-paper';

import { Dialog } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

interface NumberFieldModalProps {
  title: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (value: number) => void;
}

/**
 * Bounded numeric editor for the chunk size / delay / timeout rows.
 *
 * Out-of-range and non-numeric input is clamped rather than rejected: these
 * are throughput knobs where the nearest legal value is always a reasonable
 * interpretation, and a silent no-op would read as the dialog being broken.
 */
const NumberFieldModal = ({
  title,
  description,
  value,
  min,
  max,
  visible,
  onDismiss,
  onSubmit,
}: NumberFieldModalProps) => {
  const theme = useTheme();
  const [draft, setDraft] = useState(String(value));
  const [wasVisible, setWasVisible] = useState(visible);

  // Seed during render rather than in an effect, so the dialog never paints
  // one frame with the previous value.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(String(value));
    }
  }

  const submit = () => {
    const parsed = Number(draft.trim());
    onSubmit(
      Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value,
    );
    onDismiss();
  };

  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>{title}</Dialog.Title>
      {description ? (
        <Dialog.Description>{description}</Dialog.Description>
      ) : null}
      <Dialog.Content>
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          mode="outlined"
          keyboardType="numeric"
          underlineColor={theme.outline}
          theme={{ colors: { ...theme } }}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action onPress={submit}>
          {getString('common.save')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default NumberFieldModal;
