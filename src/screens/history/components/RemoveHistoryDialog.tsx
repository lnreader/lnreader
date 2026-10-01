import React, { useState } from 'react';

import { Checkbox, Dialog } from '@components';
import { getString } from '@i18n/translations';
import { useTheme } from '@hooks/persisted';

interface RemoveHistoryDialogProps {
  visible: boolean;
  onSubmit: (resetAllChapters: boolean) => void | Promise<void>;
  onDismiss: () => void;
}

const RemoveHistoryDialog: React.FC<RemoveHistoryDialogProps> = ({
  visible,
  onSubmit,
  onDismiss,
}) => {
  const theme = useTheme();
  const [resetAllChapters, setResetAllChapters] = useState(false);

  const handleDismiss = () => {
    setResetAllChapters(false);
    onDismiss();
  };

  const handleSubmit = () => {
    void onSubmit(resetAllChapters);
    handleDismiss();
  };

  return (
    <Dialog.Root visible={visible} onDismiss={handleDismiss}>
      <Dialog.Header>
        <Dialog.Title>{getString('common.remove')}</Dialog.Title>
        <Dialog.Description>
          {getString('historyScreen.removeHistoryWarning')}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Content>
        <Checkbox
          label={getString('historyScreen.resetAllChapters')}
          status={resetAllChapters}
          onPress={() => setResetAllChapters(value => !value)}
          theme={theme}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={handleDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action tone="danger" onPress={handleSubmit}>
          {getString('common.remove')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default RemoveHistoryDialog;
