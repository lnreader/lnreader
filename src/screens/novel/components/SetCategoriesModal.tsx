import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, View } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { Dialog } from '@components/index';

import { useTheme } from '@hooks/persisted';

import { getString } from '@i18n/translations';
import { getCategoriesWithCount } from '@database/queries/CategoryQueries';
import { updateNovelCategories } from '@database/queries/NovelQueries';
import { CCategory, Category } from '@database/types';
import { Checkbox } from '@components/Checkbox/Checkbox';
import { xor } from 'lodash-es';
import { RootStackParamList } from '@navigators/types';

interface SetCategoryModalProps {
  novelIds: number[];
  visible: boolean;
  onEditCategories?: () => void;
  closeModal: () => void;
  onSuccess?: () => void | Promise<void>;
}

const SetCategoryModal: React.FC<SetCategoryModalProps> = ({
  novelIds,
  closeModal,
  visible,
  onSuccess,
  onEditCategories,
}) => {
  const theme = useTheme();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [categories = [], setCategories] = useState<CCategory[]>();

  const getCategories = useCallback(async () => {
    const res = await getCategoriesWithCount(novelIds);
    setCategories(res);
    setSelectedCategories(res.filter(c => c.novelsCount));
  }, [novelIds]);

  useEffect(() => {
    if (visible) {
      getCategories();
    }
  }, [getCategories, visible]);

  return (
    <Dialog.Root
      visible={visible}
      onDismiss={() => {
        closeModal();
        setSelectedCategories([]);
      }}
    >
      <Dialog.Title>{getString('categories.setCategories')}</Dialog.Title>
      <Dialog.ScrollArea>
        <FlatList
          data={categories}
          style={styles.categoryList}
          renderItem={({ item }) => (
            <Checkbox
              status={
                selectedCategories.find(category => category.id === item.id) !==
                undefined
              }
              label={item.name}
              onPress={() =>
                setSelectedCategories(xor(selectedCategories, [item]))
              }
              theme={theme}
            />
          )}
          ListEmptyComponent={
            <Text
              style={[styles.emptyMessage, { color: theme.onSurfaceVariant }]}
            >
              {getString('categories.setModalEmptyMsg')}
            </Text>
          }
        />
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action
          onPress={() => {
            navigate('MoreStack', {
              screen: 'Categories',
            });
            closeModal();
            onEditCategories?.();
          }}
        >
          {getString('common.edit')}
        </Dialog.Action>
        <View style={styles.flex} />
        <Dialog.Action onPress={closeModal}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action
          onPress={async () => {
            await updateNovelCategories(
              novelIds,
              selectedCategories.map(category => category.id),
            );
            closeModal();
            void onSuccess?.();
          }}
        >
          {getString('common.ok')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default SetCategoryModal;

const styles = StyleSheet.create({
  categoryList: {
    maxHeight: Dimensions.get('window').height * 0.4,
  },
  emptyMessage: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  flex: {
    flex: 1,
  },
});
