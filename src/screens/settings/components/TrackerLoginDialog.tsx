import React, { useState } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { AppText, Dialog, TextInput } from '@components';
import { useTheme } from '@hooks/persisted';

interface TrackerLoginDialogProps {
  visible: boolean;
  trackerName: string;
  onDismiss: () => void;
  onSubmit: (username: string, password: string) => Promise<void>;
  usernameLabel?: string;
}

const TrackerLoginDialog: React.FC<TrackerLoginDialogProps> = ({
  visible,
  trackerName,
  onDismiss,
  onSubmit,
  usernameLabel = 'Username',
}) => {
  const theme = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError(`${usernameLabel} and password are required`);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSubmit(username.trim(), password);
      /* Clear form on success */
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setUsername('');
    setPassword('');
    setError('');
    onDismiss();
  };

  return (
    <Dialog.Root visible={visible} onDismiss={handleCancel}>
      <Dialog.Title>Login to {trackerName}</Dialog.Title>
      <Dialog.Content>
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxWidth()]}
        >
          <TextInput
            placeholder={usernameLabel}
            value={username}
            onChangeText={setUsername}
            singleLine
            disabled={isLoading}
          />

          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secure
            singleLine
            disabled={isLoading}
          />

          {error ? (
            <AppText variant="bodyMedium" color={theme.error}>
              {error}
            </AppText>
          ) : null}
        </Column>
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action
          title="Cancel"
          onPress={handleCancel}
          disabled={isLoading}
        />
        <Dialog.Action
          title={isLoading ? 'Logging in...' : 'Login'}
          onPress={handleSubmit}
          disabled={isLoading}
          loading={isLoading}
        />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default TrackerLoginDialog;
