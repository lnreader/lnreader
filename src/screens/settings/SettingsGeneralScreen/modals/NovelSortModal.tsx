import React from 'react';

import {
  LibrarySortOrder,
  librarySortOrderList,
} from '@screens/library/constants/constants';
import { ThemeColors } from '@theme/types';
import { SortItem } from '@components/Checkbox/Checkbox';
import { useLibrarySettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { Dialog } from '@components';

interface NovelSortModalProps {
  novelSortModalVisible: boolean;
  hideNovelSortModal: () => void;
  theme: ThemeColors;
}

const NovelSortModal: React.FC<NovelSortModalProps> = ({
  novelSortModalVisible,
  hideNovelSortModal,
  theme,
}) => {
  const { sortOrder = LibrarySortOrder.DateAdded_DESC, setLibrarySettings } =
    useLibrarySettings();
  return (
    <Dialog.Root visible={novelSortModalVisible} onDismiss={hideNovelSortModal}>
      <Dialog.Title>
        {getString('generalSettingsScreen.sortOrder')}
      </Dialog.Title>
      <Dialog.List>
        {librarySortOrderList.map(item => (
          <SortItem
            key={item.ASC}
            label={item.label}
            theme={theme}
            status={
              sortOrder === item.ASC
                ? 'asc'
                : sortOrder === item.DESC
                ? 'desc'
                : undefined
            }
            onPress={() =>
              setLibrarySettings({
                sortOrder: sortOrder === item.ASC ? item.DESC : item.ASC,
              })
            }
          />
        ))}
      </Dialog.List>
    </Dialog.Root>
  );
};

export default NovelSortModal;
