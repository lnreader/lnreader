import React from 'react';

import { ConfirmationDialog } from '@components';
import { getString } from '@i18n/translations';

interface PurgeHistoryDialogProps {
  visible: boolean;
  novelCount: number;
  libraryNovelCount: number;
  chapterCount: number;
  onSubmit: () => void | Promise<void>;
  onDismiss: () => void;
}

const PurgeHistoryDialog: React.FC<PurgeHistoryDialogProps> = ({
  visible,
  novelCount,
  libraryNovelCount,
  chapterCount,
  onSubmit,
  onDismiss,
}) => {
  const removedFromLibrary = getString(
    'historyScreen.removedFromLibrarySuffix',
    {
      count: libraryNovelCount,
    },
  );

  const message = getString('historyScreen.purgeWarning', {
    count: novelCount,
    removedFromLibrary,
  });

  const chapterLine =
    chapterCount > 0
      ? getString('historyScreen.chapterLinePresent', { count: chapterCount })
      : getString('historyScreen.chapterLineAbsent');

  return (
    <ConfirmationDialog
      title={getString('common.delete')}
      message={`${message}\n${chapterLine}`}
      confirmLabel={getString('common.delete')}
      visible={visible}
      onConfirm={onSubmit}
      onDismiss={onDismiss}
    />
  );
};

export default PurgeHistoryDialog;
