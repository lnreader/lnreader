import React from 'react';

import { ConfirmationDialog } from '@components';
import { getString } from '@i18n/translations';

interface PurgeHistoryDialogProps {
  visible: boolean;
  novelCount: number;
  libraryNovelCount: number;
  onSubmit: () => void | Promise<void>;
  onDismiss: () => void;
}

const PurgeHistoryDialog: React.FC<PurgeHistoryDialogProps> = ({
  visible,
  novelCount,
  libraryNovelCount,
  onSubmit,
  onDismiss,
}) => {
  const parts: string[] = [`${novelCount} novels`];
  if (libraryNovelCount > 0) {
    parts.push(`${libraryNovelCount} removed from Library`);
  }
  const message =
    getString('historyScreen.clearHistorWarning') +
    '\n' +
    `${parts.join(' · ')} · downloaded chapters deleted · history cleared`;

  return (
    <ConfirmationDialog
      title={getString('common.delete')}
      message={message}
      confirmLabel={getString('common.delete')}
      visible={visible}
      onConfirm={onSubmit}
      onDismiss={onDismiss}
    />
  );
};

export default PurgeHistoryDialog;
