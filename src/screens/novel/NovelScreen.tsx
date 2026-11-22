import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';

import { Portal, Snackbar } from 'react-native-paper';
import { useAppSettings, useTheme } from '@hooks/persisted';
import EditInfoModal from './components/EditInfoModal';
import DownloadCustomChapterModal from './components/DownloadCustomChapterModal';
import { useBoolean } from '@hooks';
import NovelScreenLoading from './components/LoadingAnimation/NovelScreenLoading';
import { NovelScreenProps } from '@navigators/types';
import { getString } from '@i18n/translations';
import ExportNovelAsEpubButton from './components/ExportNovelAsEpubButton';
import NovelScreenList from './components/NovelScreenList';
import { SafeAreaView } from '@components';
import { useNovelActions, useNovelValue } from './NovelContext';
import type { NativeChapterListRef } from '@components/NativeChapterList';
import { useCustomNovelCover } from './hooks/useCustomNovelCover';
import { useNovelScreenActions } from './hooks/useNovelScreenActions';
import { useNovelRefresh } from './hooks/useNovelRefresh';
import SetCategoryModal from './components/SetCategoriesModal';
import { backgroundTasks } from '@services/backgroundTasks';
import { useLibraryActions } from '@components/Context/LibraryContext';
import { novelAction, type NovelAction } from './hooks/useNativeNovelDetails';
import type { MaterialDesignIconName } from '@type/icon';

const SELECTION_LABELS = {
  'download-outline': 'common.downloads',
  'trash-can-outline': 'common.delete',
  'bookmark-outline': 'novelScreen.nativeDetails.bookmark',
  check: 'novelScreen.nativeDetails.markRead',
  'check-outline': 'novelScreen.nativeDetails.markUnread',
  'playlist-check': 'novelScreen.nativeDetails.markPreviousRead',
  'playlist-remove': 'novelScreen.nativeDetails.markPreviousUnread',
} as const;

const Novel = ({ route, navigation }: NovelScreenProps) => {
  const novel = useNovelValue('novel');
  const loading = useNovelValue('loading');
  const error = useNovelValue('error');
  const chapters = useNovelValue('chapters');
  const { setNovel, deleteChapters, refreshNovel } = useNovelActions();

  const theme = useTheme();
  const { downloadNewChapters, refreshNovelMetadata } = useAppSettings();

  const showNovelError = !novel && !loading && error;

  const [editInfoModal, showEditInfoModal] = useState(false);

  const chapterListRef = useRef<NativeChapterListRef | null>(null);

  const deleteDownloadsSnackbar = useBoolean();
  const {
    value: setCategoriesModalVisible,
    setTrue: showSetCategoriesModal,
    setFalse: closeSetCategoriesModal,
  } = useBoolean();

  const { refetchLibrary } = useLibraryActions();
  const handleCategoriesUpdated = useCallback(async () => {
    if (novel && !novel.inLibrary) setNovel({ ...novel, inLibrary: true });
    await refetchLibrary();
  }, [novel, setNovel, refetchLibrary]);

  const [exportVisible, setExportVisible] = useState(false);

  const {
    value: dlChapterModalVisible,
    setTrue: openDlChapterModal,
    setFalse: closeDlChapterModal,
  } = useBoolean();

  const {
    deleteDownloadedChapters,
    downloadAvailableChapters,
    downloadChapters,
    runSelectionAction,
    shareNovel,
  } = useNovelScreenActions({
    chapters,
    novel,
  });

  const setCustomNovelCover = useCustomNovelCover(novel, setNovel);
  const { updating, refresh: onRefresh } = useNovelRefresh({
    novel,
    downloadNewChapters,
    refreshNovelMetadata,
    reloadNovel: refreshNovel,
    enqueue: backgroundTasks.enqueue,
  });

  const hideEditInfoModal = useCallback(() => showEditInfoModal(false), []);
  const snackbarTheme = useMemo(() => ({ colors: theme }), [theme]);
  const snackbarTextStyle = useMemo(
    () => ({ color: theme.onSurface }),
    [theme.onSurface],
  );
  const snackbarAction = useMemo(
    () => ({
      label: getString('common.delete'),
      onPress: () => {
        deleteChapters(
          chapters.filter(c => c.isDownloaded).map(chapter => chapter.id),
        );
      },
    }),
    [chapters, deleteChapters],
  );

  const isLocal = novel?.isLocal ?? route.params?.isLocal ?? false;
  const downloadMenu = [
    novelAction(
      'download-next',
      getString('novelScreen.download.next'),
      undefined,
      () => downloadAvailableChapters(1),
    ),
    novelAction(
      'download-next-5',
      getString('novelScreen.download.next5'),
      undefined,
      () => downloadAvailableChapters(5),
    ),
    novelAction(
      'download-next-10',
      getString('novelScreen.download.next10'),
      undefined,
      () => downloadAvailableChapters(10),
    ),
    novelAction(
      'download-custom',
      getString('novelScreen.download.custom'),
      undefined,
      openDlChapterModal,
    ),
    novelAction(
      'download-unread',
      getString('novelScreen.download.unread'),
      undefined,
      () => downloadAvailableChapters('unread'),
    ),
    novelAction('download-all', getString('common.all'), undefined, () =>
      downloadAvailableChapters('all'),
    ),
    novelAction(
      'download-delete',
      getString('novelScreen.download.delete'),
      undefined,
      deleteDownloadedChapters,
    ),
  ];
  const overflowMenu = [
    ...(!isLocal
      ? [
          novelAction(
            'refresh',
            getString('webview.refresh'),
            undefined,
            onRefresh,
          ),
        ]
      : []),
    ...(novel?.inLibrary
      ? [
          novelAction(
            'edit-categories',
            getString('categories.header'),
            undefined,
            showSetCategoriesModal,
          ),
        ]
      : []),
    novelAction('share', getString('webview.share'), undefined, shareNovel),
    novelAction(
      'edit-info',
      getString('novelScreen.edit.info'),
      undefined,
      () => showEditInfoModal(true),
    ),
    novelAction(
      'edit-cover-menu',
      getString('novelScreen.edit.cover'),
      undefined,
      () => {
        void setCustomNovelCover();
      },
    ),
  ];
  const selectionToolbar = [
    novelAction('clear-selection', getString('common.close'), 'close'),
    novelAction(
      'select-all',
      getString('novelScreen.nativeDetails.selectAll'),
      'select-all',
    ),
  ];
  const toolbar: NovelAction[] = [
    novelAction(
      'back',
      getString('common.back'),
      'arrow-left',
      navigation.goBack,
    ),
    novelAction(
      'export',
      getString('novelScreen.exportEpubModal.title'),
      'file-export-outline',
      () => setExportVisible(true),
    ),
    novelAction(
      'jump',
      getString('novelScreen.jumpToChapterModal.jumpToChapter'),
      'book-search-outline',
    ),
    ...(!isLocal
      ? [
          {
            ...novelAction(
              'downloads',
              getString('common.downloads'),
              'download-outline',
            ),
            menu: downloadMenu,
          },
        ]
      : []),
    {
      ...novelAction(
        'overflow',
        getString('common.moreOptions'),
        'dots-vertical',
      ),
      menu: overflowMenu,
    },
  ];
  const nativeSelectionActions = Object.entries(SELECTION_LABELS).map(
    ([icon, label]) =>
      novelAction(
        `selection-${icon}`,
        getString(label),
        icon as MaterialDesignIconName,
      ),
  );

  return (
    <Portal.Host>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView excludeTop excludeBottom>
          <Suspense fallback={<NovelScreenLoading theme={theme} />}>
            <NovelScreenList
              toolbar={showNovelError ? toolbar.slice(0, 1) : toolbar}
              selectionActions={nativeSelectionActions}
              selectionToolbar={selectionToolbar}
              onSelectionAction={runSelectionAction}
              onEditCategories={showSetCategoriesModal}
              error={showNovelError || undefined}
              listRef={chapterListRef}
              navigation={navigation}
              routeBaseNovel={route.params}
              deleteDownloadSnackbar={deleteDownloadsSnackbar}
              onRefresh={onRefresh}
              updating={updating}
            />
          </Suspense>
        </SafeAreaView>

        {novel && setCategoriesModalVisible ? (
          <SetCategoryModal
            novelIds={[novel.id]}
            closeModal={closeSetCategoriesModal}
            onSuccess={handleCategoriesUpdated}
            visible
          />
        ) : null}

        <Portal>
          <Snackbar
            visible={deleteDownloadsSnackbar.value}
            onDismiss={deleteDownloadsSnackbar.setFalse}
            action={snackbarAction}
            theme={snackbarTheme}
            style={styles.snackbar}
          >
            <Text style={snackbarTextStyle}>
              {getString('novelScreen.deleteMessage')}
            </Text>
          </Snackbar>
        </Portal>
        <Portal>
          {exportVisible ? (
            <ExportNovelAsEpubButton
              novel={novel}
              onDismiss={() => setExportVisible(false)}
            />
          ) : null}
          {novel && editInfoModal ? (
            <EditInfoModal
              modalVisible
              hideModal={hideEditInfoModal}
              novel={novel}
              setNovel={setNovel}
              theme={theme}
            />
          ) : null}
          {novel && dlChapterModalVisible ? (
            <DownloadCustomChapterModal
              modalVisible
              hideModal={closeDlChapterModal}
              novel={novel}
              chapters={chapters}
              theme={theme}
              downloadChapters={downloadChapters}
            />
          ) : null}
        </Portal>
      </View>
    </Portal.Host>
  );
};

export default Novel;

const styles = StyleSheet.create({
  container: { flex: 1 },
  snackbar: { bottom: 24 },
});
