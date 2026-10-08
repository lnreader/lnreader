import React, { memo } from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  clip,
  combinedClickable,
  fillMaxWidth,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { NovelInfo } from '@database/types';
import { useNavigation } from '@react-navigation/native';
import { useBoolean } from '@hooks';
import { ThemeColors } from '@theme/types';
import { getString } from '@i18n/translations';
import SetCategoryModal from '../SetCategoriesModal';
import { NovelScreenProps } from '@navigators/types';
import { useTrackedNovel, useTracker } from '@hooks/persisted';
import { useNovelAction } from '@screens/novel/NovelContext';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { AppIcon, AppText, type IconSource } from '@components';
import CheckIcon from '@expo/material-symbols/check.xml';
import FavoriteIcon from '@expo/material-symbols/favorite.xml';
import PublicIcon from '@expo/material-symbols/public.xml';
import SwapVertIcon from '@expo/material-symbols/swap_vert.xml';
import SyncIcon from '@expo/material-symbols/sync.xml';
// @expo/material-symbols only ships outlined icons.
import FavoriteFilledIcon from '../../../../../assets/icons/favorite_fill.xml';

const NButton = ({
  onPress,
  onLongPress,
  icon,
  label,
  color,
  theme,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  icon: IconSource;
  label: string;
  color?: string;
  theme: ThemeColors;
}) => {
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 4 }}
      modifiers={[
        weight(1),
        clip(Shapes.RoundedCorner(16)),
        combinedClickable({ onClick: onPress, onLongClick: onLongPress }),
        padding(4, 8, 4, 8),
      ]}
    >
      <AppIcon source={icon} tint={color ?? theme.outline} />
      <AppText
        variant="labelMedium"
        color={color ?? theme.outline}
        maxLines={1}
        align="center"
      >
        {label}
      </AppText>
    </Column>
  );
};
const Button = memo(NButton);

interface NovelScreenButtonGroupProps {
  novel: NovelInfo | (Omit<NovelInfo, 'id'> & { id: 'NO_ID' });
  theme: ThemeColors;
  handleTrackerSheet: () => void;
  handleFollowNovel: () => void;
}

const NovelScreenButtonGroup: React.FC<NovelScreenButtonGroupProps> = ({
  novel,
  handleTrackerSheet,
  handleFollowNovel,
  theme,
}) => {
  const { inLibrary, isLocal } = novel;
  const { navigate } = useNavigation<NovelScreenProps['navigation']>();
  const { tracker } = useTracker();
  const { trackedNovel } = useTrackedNovel(novel.id);
  const setNovel = useNovelAction('setNovel');
  const { refetchLibrary } = useLibraryContext();

  const followButtonColor = inLibrary ? theme.primary : theme.outline;
  const trackerButtonColor = trackedNovel ? theme.primary : theme.outline;

  const handleOpenWebView = async () => {
    navigate('WebviewScreen', {
      name: novel.name,
      url: novel.path,
      pluginId: novel.pluginId,
      isNovel: true,
    });
  };
  const handleMigrateNovel = () =>
    novel.id !== 'NO_ID' &&
    navigate('MigrateNovel', {
      novel: novel,
    });
  const handleCategoriesUpdated = async () => {
    if (!novel.inLibrary && novel.id !== 'NO_ID') {
      setNovel({ ...novel, inLibrary: true });
    }
    await refetchLibrary();
  };

  const {
    value: setCategoryModalVisible,
    setTrue: showSetCategoryModal,
    setFalse: closeSetCategoryModal,
  } = useBoolean();

  return (
    <>
      <Row modifiers={[fillMaxWidth(), padding(8, 0, 8, 4)]}>
        <Button
          theme={theme}
          onPress={handleFollowNovel}
          onLongPress={showSetCategoryModal}
          icon={inLibrary ? FavoriteFilledIcon : FavoriteIcon}
          label={getString(
            inLibrary ? 'novelScreen.inLibaray' : 'novelScreen.addToLibaray',
          )}
          color={followButtonColor}
        />

        {tracker ? (
          <Button
            theme={theme}
            onPress={handleTrackerSheet}
            icon={trackedNovel ? CheckIcon : SyncIcon}
            label={
              trackedNovel
                ? getString('novelScreen.tracked')
                : getString('novelScreen.tracking')
            }
            color={trackerButtonColor}
          />
        ) : null}
        {inLibrary && !isLocal ? (
          <Button
            theme={theme}
            onPress={handleMigrateNovel}
            icon={SwapVertIcon}
            label={getString('novelScreen.migrate')}
          />
        ) : null}
        {!isLocal ? (
          <Button
            theme={theme}
            onPress={handleOpenWebView}
            icon={PublicIcon}
            label={'WebView'}
          />
        ) : null}
      </Row>
      {novel.id !== 'NO_ID' && setCategoryModalVisible ? (
        <SetCategoryModal
          novelIds={[novel.id]}
          closeModal={closeSetCategoryModal}
          onSuccess={handleCategoriesUpdated}
          visible
        />
      ) : null}
    </>
  );
};

export default memo(NovelScreenButtonGroup);
