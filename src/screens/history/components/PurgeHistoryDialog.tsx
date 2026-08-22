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
  const removedFromLibrary =
    libraryNovelCount > 0
      ? getString('historyScreen.removedFromLibrarySuffix', {
          count: libraryNovelCount,
        })
      : getString('historyScreen.removedFromLibrarySuffix_zero');

  const message = getString('historyScreen.purgeWarning_other', {
    count: novelCount,
    removedFromLibrary,
  });

  const chapterLine =
    chapterCount > 0
      ? `${chapterCount} downloaded ${
          chapterCount === 1 ? 'chapter' : 'chapters'
        } will be deleted.`
      : 'No downloaded chapters for this selection.';

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
