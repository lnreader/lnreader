import React from 'react';

import { ConfirmationDialog } from '@components/index';

import { Category } from '@database/types';
import { deleteCategoryById } from '@database/queries/CategoryQueries';
import { getString } from '@i18n/translations';

interface DeleteCategoryModalProps {
  category: Category;
  visible: boolean;
  closeModal: () => void;
  onSuccess: () => Promise<void>;
}

const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  category,
  closeModal,
  visible,
  onSuccess,
}) => {
  return (
    <ConfirmationDialog
      title={getString('categories.deleteModal.header')}
      confirmLabel={getString('common.delete')}
      message={`${getString('categories.deleteModal.desc')} "${
        category.name
      }"?`}
      visible={visible}
      onDismiss={closeModal}
      onConfirm={() => {
        deleteCategoryById(category);
        void onSuccess();
      }}
    />
  );
};

export default DeleteCategoryModal;
