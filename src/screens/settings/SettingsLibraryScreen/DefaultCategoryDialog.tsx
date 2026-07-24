import React from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { Dialog, RadioButton } from '@components';

import { getString } from '@i18n/translations';
import { useTheme } from '@hooks/persisted';

import { Category } from '@database/types';

interface DefaultCategoryDialogProps {
  visible: boolean;
  hideDialog: () => void;
  categories: Category[];
  defaultCategoryId: number;
  setDefaultCategory: (categoryId: number) => void;
}

const DefaultCategoryDialog: React.FC<DefaultCategoryDialogProps> = ({
  categories,
  defaultCategoryId,
  hideDialog,
  visible,
  setDefaultCategory,
}) => {
  const theme = useTheme();

  return (
    <Dialog.Root visible={visible} onDismiss={hideDialog}>
      <Dialog.Title>{getString('categories.defaultCategory')}</Dialog.Title>
      <Dialog.ScrollArea>
        <FlatList
          style={styles.scrollArea}
          initialNumToRender={10}
          data={categories}
          renderItem={({ item }) => (
            <RadioButton
              status={item.id === defaultCategoryId}
              label={item.name}
              onPress={() => setDefaultCategory(item.id)}
              theme={theme}
            />
          )}
        />
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

const styles = StyleSheet.create({
  scrollArea: {
    maxHeight: 480,
  },
});
