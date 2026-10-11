import { Dialog } from '@components';
import { getString } from '@i18n/translations';

interface RestoreConfirmationDialogProps {
  visible: boolean;
  onCancel: () => void;
  onRestore: () => void;
}

const RestoreConfirmationDialog = ({
  visible,
  onCancel,
  onRestore,
}: RestoreConfirmationDialogProps) => (
  <Dialog.Root visible={visible} onDismiss={onCancel}>
    <Dialog.Header>
      <Dialog.Title>{getString('backupScreen.restoreBackup')}</Dialog.Title>
      <Dialog.Description>
        {getString('backupScreen.restoreMayBePartial')}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Actions>
      <Dialog.Action onPress={onCancel}>
        {getString('common.cancel')}
      </Dialog.Action>
      <Dialog.Action onPress={onRestore}>
        {getString('common.restore')}
      </Dialog.Action>
    </Dialog.Actions>
  </Dialog.Root>
);

export default RestoreConfirmationDialog;
