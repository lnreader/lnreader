import React from 'react';

import { Dialog, RadioButton } from '@components';

import { getString } from '@i18n/translations';

import { Category } from '@database/types';
import { useTheme } from '@hooks/persisted';

interface DefaultCategoryDialogProps {
  visible: boolean;
  hideDialog: () => void;
  categories: Category[];
  defaultCategoryId?: number;
  promptForCategoryOnAdd: boolean;
  setPromptForCategoryOnAdd: () => void;
  setDefaultCategory: (categoryId: number) => void | Promise<void>;
}

const DefaultCategoryDialog: React.FC<DefaultCategoryDialogProps> = ({
  categories,
  defaultCategoryId,
  hideDialog,
  visible,
  promptForCategoryOnAdd,
  setPromptForCategoryOnAdd,
  setDefaultCategory,
}) => {
  const theme = useTheme();
  return (
    <Dialog.Root visible={visible} onDismiss={hideDialog}>
      <Dialog.Title>{getString('categories.defaultCategory')}</Dialog.Title>
      <Dialog.ScrollArea>
        <RadioButton
          status={promptForCategoryOnAdd}
          label={getString('categories.alwaysAsk')}
          onPress={setPromptForCategoryOnAdd}
          theme={theme}
        />
        {categories.map(item => (
          <RadioButton
            key={item.id.toString()}
            status={!promptForCategoryOnAdd && item.id === defaultCategoryId}
            label={item.name}
            onPress={() => setDefaultCategory(item.id)}
            theme={theme}
          />
        ))}
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={hideDialog}>
          {getString('common.cancel')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default DefaultCategoryDialog;
