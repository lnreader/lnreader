import React, { useState } from 'react';

import { Dialog, TextInput } from '@components/index';

import { Category } from '../../../database/types';
import {
  createCategory,
  isCategoryNameDuplicate,
  updateCategory,
} from '../../../database/queries/CategoryQueries';

import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';

interface AddCategoryModalProps {
  isEditMode?: boolean;
  category?: Category;
  visible: boolean;
  closeModal: () => void;
  onSuccess: () => void;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isEditMode,
  category,
  closeModal,
  visible,
  onSuccess,
}) => {
  const [categoryName, setCategoryName] = useState(category?.name || '');

  function close() {
    setCategoryName('');
    closeModal();
  }
  function finalize() {
    onSuccess();
    close();
  }

  return (
    <Dialog.Root visible={visible} onDismiss={close}>
      <Dialog.Title>
        {getString(
          isEditMode ? 'categories.editCategories' : 'categories.addCategories',
        )}
      </Dialog.Title>
      <Dialog.Content>
        <TextInput
          autoFocus
          value={categoryName}
          placeholder={getString('common.name')}
          onChangeText={setCategoryName}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={close}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action
          disabled={!categoryName.trim()}
          onPress={async () => {
            const normalizedName = categoryName.trim();
            if (isCategoryNameDuplicate(normalizedName)) {
              showToast(getString('categories.duplicateError'));
            } else {
              if (isEditMode && category) {
                await updateCategory(category.id, normalizedName);
              } else {
                await createCategory(normalizedName);
              }
              finalize();
            }
          }}
        >
          {getString(isEditMode ? 'common.ok' : 'common.add')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default AddCategoryModal;
