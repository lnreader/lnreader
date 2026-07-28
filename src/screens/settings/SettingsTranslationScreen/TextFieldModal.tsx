import { useState } from 'react';
import { TextInput } from 'react-native-paper';

import { Dialog } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

interface TextFieldModalProps {
  title: string;
  description?: string;
  value: string;
  placeholder?: string;
  /** Masks input and disables autocorrect — used for API keys. */
  secure?: boolean;
  /** For JSON header/body templates, which need room to read. */
  multiline?: boolean;
  keyboardType?: 'default' | 'url' | 'numeric';
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (value: string) => void;
}

/**
 * Single-field editor shared by the endpoint, model and API key rows.
 *
 * The draft is seeded from `value` each time the dialog opens so a dismissed
 * edit is discarded rather than lingering until the screen unmounts.
 */
const TextFieldModal = ({
  title,
  description,
  value,
  placeholder,
  secure,
  multiline,
  keyboardType = 'default',
  visible,
  onDismiss,
  onSubmit,
}: TextFieldModalProps) => {
  const theme = useTheme();
  const [draft, setDraft] = useState(value);
  const [wasVisible, setWasVisible] = useState(visible);

  // Reset during render rather than in an effect: this is deriving state from
  // a prop change, so an effect would render once with the stale draft first.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
    }
  }

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
          placeholder={placeholder}
          onChangeText={setDraft}
          mode="outlined"
          secureTextEntry={secure}
          multiline={multiline}
          numberOfLines={multiline ? 6 : 1}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          underlineColor={theme.outline}
          theme={{ colors: { ...theme } }}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action
          onPress={() => {
            onSubmit(draft.trim());
            onDismiss();
          }}
        >
          {getString('common.save')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default TextFieldModal;
