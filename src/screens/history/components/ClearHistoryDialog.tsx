import React from 'react';

import { ConfirmationDialog } from '@components';
import { getString } from '@i18n/translations';

interface ClearHistoryDialogProps {
  visible: boolean;
  onSubmit: () => void;
  onDismiss: () => void;
}

const ClearHistoryDialog: React.FC<ClearHistoryDialogProps> = ({
  visible,
  onDismiss,
  onSubmit,
}) => (
  <ConfirmationDialog
    title={getString('common.clear')}
    message={getString('historyScreen.clearHistorWarning')}
    confirmLabel={getString('common.clear')}
    visible={visible}
    onConfirm={onSubmit}
    onDismiss={onDismiss}
  />
);

export default ClearHistoryDialog;
