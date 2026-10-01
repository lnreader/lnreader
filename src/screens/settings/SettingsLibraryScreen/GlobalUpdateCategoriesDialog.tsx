import { useCallback } from 'react';
import { ListItem } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, toggleable } from '@expo/ui/jetpack-compose/modifiers';

import { AppIcon, AppText, Dialog, listItemColors } from '@components';
import type { Category } from '@database/types';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import CheckBoxIcon from '@expo/material-symbols/check_box.xml';
import CheckBoxOutlineBlankIcon from '@expo/material-symbols/check_box_outline_blank.xml';
import DisabledByDefaultIcon from '@expo/material-symbols/disabled_by_default.xml';

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
}

const GlobalUpdateCategoriesDialog = ({
  categories,
  excludedCategoryIds,
  includedCategoryIds,
  visible,
  onCancel,
  onChange,
  onSave,
}: GlobalUpdateCategoriesDialogProps) => {
  const theme = useTheme();

  const renderCategory = useCallback(
    (item: Category) => {
      const isIncluded = includedCategoryIds.includes(item.id);
      const isExcluded = excludedCategoryIds.includes(item.id);
      const icon = isExcluded
        ? DisabledByDefaultIcon
        : isIncluded
        ? CheckBoxIcon
        : CheckBoxOutlineBlankIcon;

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
        <ListItem
          key={item.id.toString()}
          colors={listItemColors(theme)}
          modifiers={[
            fillMaxWidth(),
            toggleable(isIncluded || isExcluded, toggleCategory, {
              role: 'checkbox',
            }),
          ]}
        >
          <ListItem.LeadingContent>
            <AppIcon
              source={icon}
              tint={
                isIncluded || isExcluded
                  ? theme.primary
                  : theme.onSurfaceVariant
              }
            />
          </ListItem.LeadingContent>
          <ListItem.HeadlineContent>
            <AppText variant="bodyLarge">{item.name}</AppText>
          </ListItem.HeadlineContent>
        </ListItem>
      );
    },
    [excludedCategoryIds, includedCategoryIds, onChange, theme],
  );

  return (
    <Dialog.Root visible={visible} onDismiss={onCancel}>
      <Dialog.Header>
        <Dialog.Title>
          {getString('generalSettingsScreen.globalUpdateCategories')}
        </Dialog.Title>
        <Dialog.Description>
          {getString('generalSettingsScreen.globalUpdateCategoriesDescription')}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.ScrollArea>{categories.map(renderCategory)}</Dialog.ScrollArea>
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
