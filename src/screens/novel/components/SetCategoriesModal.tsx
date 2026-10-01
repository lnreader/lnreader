import React, { useEffect, useState } from 'react';
import { Spacer } from '@expo/ui/jetpack-compose';
import { padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { AppText, Dialog } from '@components/index';

import { useTheme } from '@hooks/persisted';

import { getString } from '@i18n/translations';
import { getCategoriesWithCount } from '@database/queries/CategoryQueries';
import { updateNovelCategories } from '@database/queries/NovelQueries';
import { CCategory, Category } from '@database/types';
import { Checkbox } from '@components/Checkbox/Checkbox';
import xor from 'lodash-es/xor';
import { RootStackParamList } from '@navigators/types';

interface SetCategoryModalProps {
  novelIds: number[];
  initialCategoryIds?: number[];
  visible: boolean;
  onEditCategories?: () => void;
  closeModal: () => void;
  onSuccess?: () => void | Promise<void>;
  onSubmit?: (categoryIds: number[]) => void | Promise<void>;
}

const SetCategoryModal: React.FC<SetCategoryModalProps> = ({
  novelIds,
  initialCategoryIds,
  closeModal,
  visible,
  onSuccess,
  onEditCategories,
  onSubmit,
}) => {
  const theme = useTheme();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [categories = [], setCategories] = useState<CCategory[]>();

  useEffect(() => {
    let active = true;
    void getCategoriesWithCount(novelIds).then(result => {
      if (active) {
        setCategories(result);
        setSelectedCategories(
          result.filter(category =>
            initialCategoryIds
              ? initialCategoryIds.includes(category.id)
              : category.novelsCount,
          ),
        );
      }
    });
    return () => {
      active = false;
    };
  }, [initialCategoryIds, novelIds]);

  return (
    <Dialog.Root visible={visible} onDismiss={closeModal}>
      <Dialog.Title>{getString('categories.setCategories')}</Dialog.Title>
      <Dialog.ScrollArea fixed>
        {categories.length ? (
          categories.map(item => (
            <Checkbox
              key={item.id}
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
          ))
        ) : (
          <AppText
            color={theme.onSurfaceVariant}
            modifiers={[padding(16, 16, 16, 16)]}
          >
            {getString('categories.setModalEmptyMsg')}
          </AppText>
        )}
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
        <Spacer modifiers={[weight(1)]} />
        <Dialog.Action onPress={closeModal}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action
          onPress={async () => {
            const categoryIds = selectedCategories.map(category => category.id);
            if (onSubmit) {
              await onSubmit(categoryIds);
            } else {
              await updateNovelCategories(novelIds, categoryIds);
            }
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
