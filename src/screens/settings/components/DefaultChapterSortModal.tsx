import { SortItem } from '@components/Checkbox/Checkbox';

import { ThemeColors } from '@theme/types';
import { AppSettings } from '@hooks/persisted/useSettings';
import { getString } from '@i18n/translations';
import { Dialog } from '@components';
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
    <Dialog.Root visible={displayModalVisible} onDismiss={hideDisplayModal}>
      <Dialog.Title>
        {getString('generalSettingsScreen.chapterSort')}
      </Dialog.Title>
      <Dialog.List>
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
      </Dialog.List>
      <Dialog.Actions>
        <Dialog.Action onPress={hideDisplayModal}>
          {getString('common.ok')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default DefaultChapterSortModal;
