import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
} from 'react-native-reanimated';
import Color from 'color';
import { getString } from '@i18n/translations';
import { Appbar, IconButtonV2, OverflowMenu } from '@components';
import { ThemeColors } from '@theme/types';
import ExportNovelAsEpubButton from './ExportNovelAsEpubButton';
import { NovelInfo } from '@database/types';
import DownloadIcon from '@expo/material-symbols/download.xml';
import FileExportIcon from '@expo/material-symbols/file_export.xml';
import ManageSearchIcon from '@expo/material-symbols/manage_search.xml';

const NovelAppbar = ({
  novel,
  theme,
  isLocal,
  downloadChapters,
  deleteChapters,
  showEditInfoModal,
  downloadCustomChapterModal,
  setCustomNovelCover,
  goBack,
  shareNovel,
  refreshNovel,
  editCategories,
  showJumpToChapterModal,
  headerOpacity,
  hideActions = false,
}: {
  novel: NovelInfo | undefined;
  theme: ThemeColors;
  isLocal: boolean | undefined;
  downloadChapters: (amount: number | 'all' | 'unread') => void;
  deleteChapters: () => void;
  showEditInfoModal: React.Dispatch<React.SetStateAction<boolean>>;
  downloadCustomChapterModal: () => void;
  setCustomNovelCover: () => Promise<void>;
  goBack: () => void;
  shareNovel: () => void;
  refreshNovel: () => void;
  editCategories: () => void;
  showJumpToChapterModal: (arg: boolean) => void;
  headerOpacity: SharedValue<number>;
  hideActions?: boolean;
}) => {
  // The Compose bar cannot read a shared value; it fades in tenths.
  const [opacity, setOpacity] = useState(0);
  useAnimatedReaction(
    () => Math.round(headerOpacity.value * 10) / 10,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setOpacity)(current);
      }
    },
    [headerOpacity],
  );

  const renderExportIcon = useCallback(
    (onPress: () => void) => (
      <IconButtonV2
        name={FileExportIcon}
        accessibilityLabel={getString('novelScreen.exportEpubModal.title')}
        onPress={onPress}
        theme={theme}
      />
    ),
    [theme],
  );

  const downloadMenuItems = useMemo(() => {
    return [
      {
        label: getString('novelScreen.download.next'),
        onPress: () => downloadChapters(1),
      },
      {
        label: getString('novelScreen.download.next5'),
        onPress: () => downloadChapters(5),
      },
      {
        label: getString('novelScreen.download.next10'),
        onPress: () => downloadChapters(10),
      },
      {
        label: getString('novelScreen.download.custom'),
        onPress: () => downloadCustomChapterModal(),
      },
      {
        label: getString('novelScreen.download.unread'),
        onPress: () => downloadChapters('unread'),
      },
      {
        label: getString('common.all'),
        onPress: () => downloadChapters('all'),
      },
      {
        label: getString('novelScreen.download.delete'),
        onPress: () => deleteChapters(),
      },
    ];
  }, [deleteChapters, downloadChapters, downloadCustomChapterModal]);

  const extraMenuItems = useMemo(() => {
    const items = [];

    if (!isLocal) {
      items.push({
        label: getString('webview.refresh'),
        onPress: refreshNovel,
      });
    }

    if (novel?.inLibrary) {
      items.push({
        label: getString('categories.header'),
        onPress: editCategories,
      });
    }

    items.push(
      {
        label: getString('webview.share'),
        onPress: shareNovel,
      },
      {
        label: getString('novelScreen.edit.info'),
        onPress: () => showEditInfoModal(true),
      },
      {
        label: getString('novelScreen.edit.cover'),
        onPress: () => setCustomNovelCover(),
      },
    );

    return items;
  }, [
    editCategories,
    isLocal,
    novel?.inLibrary,
    refreshNovel,
    setCustomNovelCover,
    shareNovel,
    showEditInfoModal,
  ]);

  const openJumpToChapter = useCallback(
    () => showJumpToChapterModal(true),
    [showJumpToChapterModal],
  );

  return (
    <Appbar
      handleGoBack={goBack}
      title={opacity > 0 ? novel?.name ?? '' : ''}
      titleColor={Color(theme.onSurface).alpha(opacity).string()}
      theme={theme}
      containerColor={Color(theme.surfaceContainer).alpha(opacity).string()}
    >
      {hideActions ? null : (
        <>
          <ExportNovelAsEpubButton
            novel={novel}
            renderIcon={renderExportIcon}
          />
          <IconButtonV2
            name={ManageSearchIcon}
            accessibilityLabel={getString(
              'novelScreen.jumpToChapterModal.jumpToChapter',
            )}
            onPress={openJumpToChapter}
            theme={theme}
          />
          {!isLocal ? (
            <OverflowMenu
              icon={DownloadIcon}
              label={getString('common.downloads')}
              actions={downloadMenuItems}
            />
          ) : null}
          <OverflowMenu actions={extraMenuItems} />
        </>
      )}
    </Appbar>
  );
};

export default memo(NovelAppbar);
