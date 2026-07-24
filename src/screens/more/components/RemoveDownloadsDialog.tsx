import { ConfirmationDialog } from '@components';
import { getString } from '@i18n/translations';

interface RemoveDownloadsDialogProps {
  dialogVisible: boolean;
  hideDialog: () => void;
  onSubmit: () => void;
}

const RemoveDownloadsDialog = ({
  dialogVisible,
  hideDialog,
  onSubmit,
}: RemoveDownloadsDialogProps) => (
  <ConfirmationDialog
    title={`${getString('common.remove')} ${getString('common.downloads')}`}
    message={getString('downloadScreen.removeDownloadsWarning')}
    confirmLabel={getString('common.remove')}
    visible={dialogVisible}
    onConfirm={onSubmit}
    onDismiss={hideDialog}
  />
);

export default RemoveDownloadsDialog;
