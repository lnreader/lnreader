import React from 'react';
import { Box } from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';

import { getString } from '@i18n/translations';
import { useBoolean } from '@hooks/index';
import { AppIcon, IconButtonV2, Menu, ProgressIndicator } from '@components';
import ArrowCircleDownIcon from '@expo/material-symbols/arrow_circle_down.xml';
import BookmarkIcon from '@expo/material-symbols/bookmark.xml';
import CheckCircleIcon from '@expo/material-symbols/check_circle.xml';

interface DownloadButtonProps {
  isDownloaded: boolean;
  isDownloading?: boolean;
  theme: ThemeColors;
  deleteChapter: () => void;
  downloadChapter: () => void;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  isDownloaded,
  isDownloading,
  theme,
  deleteChapter,
  downloadChapter,
}) => {
  const {
    value: deleteChapterMenuVisible,
    setTrue: showDeleteChapterMenu,
    setFalse: hideDeleteChapterMenu,
  } = useBoolean();

  if (isDownloading) {
    return <ChapterDownloadingButton theme={theme} />;
  }
  if (isDownloaded) {
    return (
      <Menu
        visible={deleteChapterMenuVisible}
        onDismiss={hideDeleteChapterMenu}
        anchor={
          <DeleteChapterButton theme={theme} onPress={showDeleteChapterMenu} />
        }
      >
        <Menu.Item
          onPress={() => {
            deleteChapter();
            hideDeleteChapterMenu();
          }}
          title={getString('common.delete')}
        />
      </Menu>
    );
  }
  return <DownloadChapterButton theme={theme} onPress={downloadChapter} />;
};

interface theme {
  theme: ThemeColors;
}
type buttonPropType = theme & {
  onPress: () => void;
};
export const ChapterDownloadingButton: React.FC<theme> = () => (
  <Box contentAlignment="center" modifiers={[size(40, 40)]}>
    <ProgressIndicator circular modifiers={[size(22, 22)]} />
  </Box>
);

export const DownloadChapterButton: React.FC<buttonPropType> = ({
  theme,
  onPress,
}) => (
  <IconButtonV2
    name={ArrowCircleDownIcon}
    accessibilityLabel={getString('libraryScreen.bottomSheet.display.download')}
    color={theme.outline}
    onPress={onPress}
    theme={theme}
  />
);

export const DeleteChapterButton: React.FC<buttonPropType> = ({
  theme,
  onPress,
}) => (
  <IconButtonV2
    name={CheckCircleIcon}
    accessibilityLabel={getString('common.delete')}
    color={theme.onSurface}
    onPress={onPress}
    theme={theme}
  />
);

export const ChapterBookmarkButton: React.FC<theme> = ({ theme }) => (
  <Box contentAlignment="center" modifiers={[size(40, 40)]}>
    <AppIcon source={BookmarkIcon} tint={theme.primary} size={18} />
  </Box>
);
