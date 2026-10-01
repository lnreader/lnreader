import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Row, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import {
  background,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useSharedValue } from 'react-native-reanimated';

import { useAppSettings, useTheme } from '@hooks/persisted';
import JumpToChapterModal from './components/JumpToChapterModal';
import { Actionbar } from '../../components/Actionbar/Actionbar';
import EditInfoModal from './components/EditInfoModal';
import DownloadCustomChapterModal from './components/DownloadCustomChapterModal';
import { useBoolean } from '@hooks';
import NovelScreenLoading from './components/LoadingAnimation/NovelScreenLoading';
import { NovelScreenProps } from '@navigators/types';
import { getString } from '@i18n/translations';
import NovelAppbar from './components/NovelAppbar';
import NovelScreenList from './components/NovelScreenList';
import {
  AppText,
  EmptyView,
  IconButtonV2,
  Screen,
  useScreenInsets,
  type ComposeListHandle,
} from '@components';
import { useNovelActions, useNovelValue } from './NovelContext';
import { useCustomNovelCover } from './hooks/useCustomNovelCover';
import { useChapterSelection } from './hooks/useChapterSelection';
import { useNovelScreenActions } from './hooks/useNovelScreenActions';
import { useNovelRefresh } from './hooks/useNovelRefresh';
import SetCategoryModal from './components/SetCategoriesModal';
import { backgroundTasks } from '@services/backgroundTasks';
import { useWindowLayout } from '@hooks/common/useWindowLayout';
import { getPageChapterIds } from '@database/queries/ChapterQueries';
import ArrowBackIcon from '@expo/material-symbols/arrow_back.xml';
import CloseIcon from '@expo/material-symbols/close.xml';
import SelectAllIcon from '@expo/material-symbols/select_all.xml';

const Novel = ({ route, navigation }: NovelScreenProps) => {
  const novel = useNovelValue('novel');
  const loading = useNovelValue('loading');
  const error = useNovelValue('error');
  const chapters = useNovelValue('chapters');
  const novelSettings = useNovelValue('novelSettings');
  const pageIndex = useNovelValue('pageIndex');
  const pages = useNovelValue('pages');
  const { setNovel, deleteChapters, refreshNovel } = useNovelActions();

  const theme = useTheme();
  const { top } = useScreenInsets();
  const layout = useWindowLayout();
  const { downloadNewChapters, refreshNovelMetadata } = useAppSettings();

  const showNovelError = !novel && !loading && error;

  const getAllChapterIds = useCallback(() => {
    if (!novel) {
      return Promise.resolve([]);
    }

    return getPageChapterIds(
      novel.id,
      novelSettings.filter,
      pages[pageIndex],
      novelSettings.excludedScanlators,
    );
  }, [novel, novelSettings, pageIndex, pages]);

  const {
    selectedIds: selected,
    selectedChapters,
    setSelectedIds: setSelected,
    clearSelection,
    selectAll,
  } = useChapterSelection(chapters, getAllChapterIds);
  const [editInfoModal, showEditInfoModal] = useState(false);

  const chapterListRef = useRef<ComposeListHandle | null>(null);
  const snackbarRef = useRef<SnackbarHostRef>(null);

  const deleteDownloadsSnackbar = useBoolean();
  const {
    value: setCategoriesModalVisible,
    setTrue: showSetCategoriesModal,
    setFalse: closeSetCategoriesModal,
  } = useBoolean();

  const headerOpacity = useSharedValue(0);

  const [jumpToChapterModal, showJumpToChapterModal] = useState(false);
  const {
    value: dlChapterModalVisible,
    setTrue: openDlChapterModal,
    setFalse: closeDlChapterModal,
  } = useBoolean();

  const {
    deleteDownloadedChapters,
    downloadAvailableChapters,
    downloadChapters,
    selectionActions,
    shareNovel,
  } = useNovelScreenActions({
    chapters,
    clearSelection,
    novel,
    selectedIds: selected,
    selectedChapters,
  });

  const setCustomNovelCover = useCustomNovelCover(novel, setNovel);
  const { updating, refresh: onRefresh } = useNovelRefresh({
    novel,
    downloadNewChapters,
    refreshNovelMetadata,
    reloadNovel: refreshNovel,
    enqueue: backgroundTasks.enqueue,
  });

  const hideJumpToChapterModal = useCallback(
    () => showJumpToChapterModal(false),
    [],
  );
  const hideEditInfoModal = useCallback(() => showEditInfoModal(false), []);

  // Compose snackbars are shown imperatively, so the visibility flag
  // triggers one and is reset once it closes.
  const { value: deleteSnackbarVisible, setFalse: hideDeleteSnackbar } =
    deleteDownloadsSnackbar;
  useEffect(() => {
    if (!deleteSnackbarVisible) {
      return;
    }
    void snackbarRef.current
      ?.showSnackbar({
        message: getString('novelScreen.deleteMessage'),
        actionLabel: getString('common.delete'),
        duration: 'long',
      })
      .then(result => {
        hideDeleteSnackbar();
        if (result === 'actionPerformed') {
          deleteChapters(
            chapters.filter(c => c.isDownloaded).map(chapter => chapter.id),
          );
        }
      });
    // Only a new request should show it again, not later chapter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteSnackbarVisible]);

  return (
    <Screen
      // On phones the backdrop runs up behind the bar, as it always has.
      topBarOverContent={!layout.isExpanded}
      topBar={
        selected.length === 0 ? (
          <NovelAppbar
            novel={novel}
            deleteChapters={deleteDownloadedChapters}
            downloadChapters={downloadAvailableChapters}
            showEditInfoModal={showEditInfoModal}
            setCustomNovelCover={setCustomNovelCover}
            downloadCustomChapterModal={openDlChapterModal}
            showJumpToChapterModal={showJumpToChapterModal}
            shareNovel={shareNovel}
            refreshNovel={onRefresh}
            editCategories={showSetCategoriesModal}
            theme={theme}
            isLocal={novel?.isLocal ?? route.params?.isLocal ?? false}
            goBack={navigation.goBack}
            headerOpacity={headerOpacity}
            hideActions={!!showNovelError}
          />
        ) : (
          <Row
            verticalAlignment="center"
            modifiers={[
              fillMaxWidth(),
              background(theme.surface2 ?? theme.surfaceContainer),
              padding(0, top, 0, 8),
            ]}
          >
            <IconButtonV2
              name={CloseIcon}
              accessibilityLabel={getString('common.cancel')}
              color={theme.onBackground}
              onPress={clearSelection}
              theme={theme}
            />
            <AppText
              variant="titleLarge"
              color={theme.onSurface}
              modifiers={[weight(1)]}
            >
              {`${selected.length}`}
            </AppText>
            <IconButtonV2
              name={SelectAllIcon}
              accessibilityLabel={getString('backupScreen.options.selectAll')}
              color={theme.onBackground}
              onPress={selectAll}
              theme={theme}
            />
          </Row>
        )
      }
      list={
        showNovelError ? undefined : (
          <Suspense fallback={<NovelScreenLoading theme={theme} />}>
            <NovelScreenList
              headerOpacity={headerOpacity}
              listRef={chapterListRef}
              navigation={navigation}
              routeBaseNovel={route.params}
              selected={selected}
              setSelected={setSelected}
              deleteDownloadSnackbar={deleteDownloadsSnackbar}
              onRefresh={onRefresh}
              updating={updating}
            />
          </Suspense>
        )
      }
      bottomBar={
        selected.length > 0 ? (
          <Actionbar active actions={selectionActions} />
        ) : null
      }
      snackbarRef={snackbarRef}
      overlays={
        <>
          {novel && setCategoriesModalVisible ? (
            <SetCategoryModal
              novelIds={[novel.id]}
              closeModal={closeSetCategoriesModal}
              visible
            />
          ) : null}
          {novel ? (
            <>
              <JumpToChapterModal
                modalVisible={jumpToChapterModal}
                hideModal={hideJumpToChapterModal}
                novel={novel}
                chapterListRef={chapterListRef}
                navigation={navigation}
              />
              <EditInfoModal
                modalVisible={editInfoModal}
                hideModal={hideEditInfoModal}
                novel={novel}
                setNovel={setNovel}
                theme={theme}
              />
              <DownloadCustomChapterModal
                modalVisible={dlChapterModalVisible}
                hideModal={closeDlChapterModal}
                novel={novel}
                chapters={chapters}
                theme={theme}
                downloadChapters={downloadChapters}
              />
            </>
          ) : null}
        </>
      }
    >
      {showNovelError ? (
        <EmptyView
          icon="Σ(ಠ_ಠ)"
          description={error}
          actions={[
            {
              iconName: ArrowBackIcon,
              title: getString('common.back'),
              onPress: navigation.goBack,
            },
          ]}
          theme={theme}
        />
      ) : null}
    </Screen>
  );
};

export default Novel;
