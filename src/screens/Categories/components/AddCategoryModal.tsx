import React, { useState } from 'react';
import { TextInput } from 'react-native-paper';

import { Dialog } from '@components/index';

import { Category } from '../../../database/types';
import {
  createCategory,
  isCategoryNameDuplicate,
  updateCategory,
} from '../../../database/queries/CategoryQueries';
import { useTheme } from '@hooks/persisted';

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
  const theme = useTheme();
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
          defaultValue={categoryName}
          placeholder={getString('common.name')}
          onChangeText={setCategoryName}
          mode="outlined"
          underlineColor={theme.outline}
          theme={{ colors: { ...theme } }}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={close}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action
          onPress={async () => {
            if (isCategoryNameDuplicate(categoryName)) {
              showToast(getString('categories.duplicateError'));
            } else {
              if (isEditMode && category) {
                updateCategory(category?.id, categoryName);
              } else {
                await createCategory(categoryName);
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
