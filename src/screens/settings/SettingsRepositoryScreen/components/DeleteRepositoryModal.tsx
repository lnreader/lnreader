import React from 'react';

import { ConfirmationDialog } from '@components/index';

import { Repository } from '@database/types';
import { deleteRepositoryById } from '@database/queries/RepositoryQueries';
import { getString } from '@i18n/translations';
interface DeleteRepositoryModalProps {
  repository: Repository;
  visible: boolean;
  closeModal: () => void;
  onSuccess: () => void;
}

const DeleteRepositoryModal: React.FC<DeleteRepositoryModalProps> = ({
  repository,
  closeModal,
  visible,
  onSuccess,
}) => {
  return (
    <ConfirmationDialog
      title="Delete repository"
      confirmLabel={getString('common.delete')}
      message={`Do you wish to delete repository "${repository.url}"?`}
      visible={visible}
      onDismiss={closeModal}
      onConfirm={async () => {
        await deleteRepositoryById(repository.id);
        onSuccess();
      }}
    />
  );
};

export default DeleteRepositoryModal;
