import { useCallback } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { Dialog } from '@components';
import type { Category } from '@database/types';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

interface GlobalUpdateCategoriesDialogProps {
  categories: Category[];
  excludedCategoryIds: number[];
  includedCategoryIds: number[];
  visible: boolean;
  onCancel: () => void;
  onChange: (
    includedCategoryIds: number[],
    excludedCategoryIds: number[],
  ) => void;
  onSave: () => void;
  title?: string;
  description?: string;
}

const categoryKey = (category: Category) => category.id.toString();

const GlobalUpdateCategoriesDialog = ({
  categories,
  excludedCategoryIds,
  includedCategoryIds,
  visible,
  onCancel,
  onChange,
  onSave,
  title = getString('generalSettingsScreen.globalUpdateCategories'),
  description = getString(
    'generalSettingsScreen.globalUpdateCategoriesDescription',
  ),
}: GlobalUpdateCategoriesDialogProps) => {
  const theme = useTheme();

  const renderCategory = useCallback(
    ({ item }: ListRenderItemInfo<Category>) => {
      const isIncluded = includedCategoryIds.includes(item.id);
      const isExcluded = excludedCategoryIds.includes(item.id);
      const icon = isExcluded
        ? 'close-box'
        : isIncluded
        ? 'checkbox-marked'
        : 'checkbox-blank-outline';

      const toggleCategory = () => {
        if (isExcluded) {
          onChange(
            includedCategoryIds,
            excludedCategoryIds.filter(categoryId => categoryId !== item.id),
          );
        } else if (isIncluded) {
          onChange(
            includedCategoryIds.filter(categoryId => categoryId !== item.id),
            [...excludedCategoryIds, item.id],
          );
        } else {
          onChange([...includedCategoryIds, item.id], excludedCategoryIds);
        }
      };

      return (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: isExcluded ? 'mixed' : isIncluded,
          }}
          android_ripple={{ color: theme.rippleColor }}
          onPress={toggleCategory}
          style={styles.category}
        >
          <MaterialCommunityIcons
            color={
              isIncluded || isExcluded ? theme.primary : theme.onSurfaceVariant
            }
            name={icon}
            size={24}
          />
          <Text style={[styles.categoryName, { color: theme.onSurface }]}>
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [
      excludedCategoryIds,
      includedCategoryIds,
      onChange,
      theme.onSurface,
      theme.onSurfaceVariant,
      theme.primary,
      theme.rippleColor,
    ],
  );

  return (
    <Dialog.Root visible={visible} onDismiss={onCancel}>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
      </Dialog.Header>
      <Dialog.ScrollArea>
        <FlatList
          data={categories}
          initialNumToRender={10}
          keyExtractor={categoryKey}
          renderItem={renderCategory}
          style={styles.list}
        />
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={onCancel}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action onPress={onSave}>{getString('common.ok')}</Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default GlobalUpdateCategoriesDialog;

const styles = StyleSheet.create({
  category: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryName: {
    fontSize: 16,
  },
  list: {
    maxHeight: 420,
  },
});
