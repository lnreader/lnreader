import React from 'react';

import { Checkbox, Dialog } from '@components';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import { useLibrarySettings } from '@hooks/persisted';

interface NovelBadgesModalProps {
  novelBadgesModalVisible: boolean;
  hideNovelBadgesModal: () => void;
  theme: ThemeColors;
}

const NovelBadgesModal: React.FC<NovelBadgesModalProps> = ({
  novelBadgesModalVisible,
  hideNovelBadgesModal,
  theme,
}) => {
  const {
    showDownloadBadges = true,
    showNumberOfNovels = false,
    showUnreadBadges = true,
    setLibrarySettings,
  } = useLibrarySettings();
  return (
    <Dialog.Root
      visible={novelBadgesModalVisible}
      onDismiss={hideNovelBadgesModal}
    >
      <Dialog.Title>
        {getString('libraryScreen.bottomSheet.display.badges')}
      </Dialog.Title>
      <Dialog.List>
        <Checkbox
          label={getString('libraryScreen.bottomSheet.display.downloadBadges')}
          status={showDownloadBadges}
          onPress={() =>
            setLibrarySettings({
              showDownloadBadges: !showDownloadBadges,
            })
          }
          theme={theme}
        />
        <Checkbox
          label={getString('libraryScreen.bottomSheet.display.unreadBadges')}
          status={showUnreadBadges}
          onPress={() =>
            setLibrarySettings({
              showUnreadBadges: !showUnreadBadges,
            })
          }
          theme={theme}
        />
        <Checkbox
          label={getString('libraryScreen.bottomSheet.display.showNoOfItems')}
          status={showNumberOfNovels}
          onPress={() =>
            setLibrarySettings({
              showNumberOfNovels: !showNumberOfNovels,
            })
          }
          theme={theme}
        />
      </Dialog.List>
    </Dialog.Root>
  );
};

export default NovelBadgesModal;
