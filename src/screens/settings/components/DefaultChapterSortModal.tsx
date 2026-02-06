import React from 'react';

import { Portal } from 'react-native-paper';
import { SortItem } from '@components/Checkbox/Checkbox';

import { ThemeColors } from '@theme/types';
import { AppSettings } from '@hooks/persisted/useSettings';
import { getString } from '@strings/translations';
import { Modal } from '@components';
import { ChapterOrderKey } from '@database/constants';

interface DefaultChapterSortModalProps {
  theme: ThemeColors;
  setAppSettings: (values: Partial<AppSettings>) => void;
  defaultChapterSort: ChapterOrderKey;
  hideDisplayModal: () => void;
  displayModalVisible: boolean;
}

const DefaultChapterSortModal = ({
  theme,
  setAppSettings,
  defaultChapterSort,
  hideDisplayModal,
  displayModalVisible,
}: DefaultChapterSortModalProps) => {
  return (
    <Portal>
      <Modal visible={displayModalVisible} onDismiss={hideDisplayModal}>
        <SortItem
          label={getString('generalSettingsScreen.bySource')}
          theme={theme}
          status={defaultChapterSort === 'positionAsc' ? 'asc' : 'desc'}
          onPress={() =>
            defaultChapterSort === 'positionAsc'
              ? setAppSettings({
                  defaultChapterSort: 'positionDesc',
                })
              : setAppSettings({
                  defaultChapterSort: 'positionAsc',
                })
          }
        />
      </Modal>
    </Portal>
  );
};

export default DefaultChapterSortModal;
