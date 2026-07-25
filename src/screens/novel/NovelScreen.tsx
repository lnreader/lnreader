import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, StatusBar, Text } from 'react-native';
import Animated, {
  SlideInUp,
  SlideOutUp,
  useSharedValue,
} from 'react-native-reanimated';

import { Portal, Appbar, Snackbar } from 'react-native-paper';
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
import { ThemeColors } from '@theme/types';
import { SafeAreaView } from '@components';
import { useNovelActions, useNovelValue } from './NovelContext';
import { LegendListRef } from '@legendapp/list/react-native';
import { useCustomNovelCover } from './hooks/useCustomNovelCover';
import { useChapterSelection } from './hooks/useChapterSelection';
import { useNovelScreenActions } from './hooks/useNovelScreenActions';
import { useNovelRefresh } from './hooks/useNovelRefresh';
import SetCategoryModal from './components/SetCategoriesModal';
import { backgroundTasks } from '@services/backgroundTasks';
import { runWhenIdle } from '@utils/runWhenIdle';

const Novel = ({ route, navigation }: NovelScreenProps) => {
  const novel = useNovelValue('novel');
  const chapters = useNovelValue('chapters');
  const { setNovel, deleteChapters, refreshNovel } = useNovelActions();

  const theme = useTheme();
  const { downloadNewChapters, refreshNovelMetadata } = useAppSettings();

  const {
    selectedIds: selected,
    selectedChapters,
    setSelectedIds: setSelected,
    clearSelection,
    selectAll,
  } = useChapterSelection(chapters);
  const [editInfoModal, showEditInfoModal] = useState(false);
  const [editInfoModalMounted, setEditInfoModalMounted] = useState(false);

  const chapterListRef = useRef<LegendListRef | null>(null);

  const deleteDownloadsSnackbar = useBoolean();
  const {
    value: setCategoriesModalVisible,
    setTrue: showSetCategoriesModal,
    setFalse: closeSetCategoriesModal,
  } = useBoolean();
  const [categoriesModalMounted, setCategoriesModalMounted] = useState(false);

  const headerOpacity = useSharedValue(0);

  const [jumpToChapterModal, showJumpToChapterModal] = useState(false);
  const [jumpToChapterModalMounted, setJumpToChapterModalMounted] = useState(false);
  const {
    value: dlChapterModalVisible,
    setTrue: openDlChapterModal,
    setFalse: closeDlChapterModal,
  } = useBoolean();
  const [dlChapterModalMounted, setDlChapterModalMounted] = useState(false);

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

  const hideJumpToChapterModal = useCallback(() => {
    showJumpToChapterModal(false);
  }, []);

  const showJumpToChapterModalHandler = useCallback(() => {
    setJumpToChapterModalMounted(true);
    showJumpToChapterModal(true);
  }, []);

  const hideEditInfoModal = useCallback(() => showEditInfoModal(false), []);

  const showEditInfoModalHandler = useCallback(() => {
    setEditInfoModalMounted(true);
    showEditInfoModal(true);
  }, []);

  const showSetCategoriesModalHandler = useCallback(() => {
    setCategoriesModalMounted(true);
    showSetCategoriesModal();
  }, [showSetCategoriesModal]);

  const openDlChapterModalHandler = useCallback(() => {
    setDlChapterModalMounted(true);
    openDlChapterModal();
  }, [openDlChapterModal]);

  const snackbarTheme = useMemo(() => ({ colors: theme }), [theme]);
  const snackbarTextStyle = useMemo(
    () => ({ color: theme.onSurface }),
    [theme.onSurface],
  );
  const titleStyle = useMemo(
    () => ({ color: theme.onSurface }),
    [theme.onSurface],
  );
  const snackbarAction = useMemo(
    () => ({
      label: getString('common.delete'),
      onPress: () => {
        deleteChapters(chapters.filter(c => c.isDownloaded));
      },
    }),
    [chapters, deleteChapters],
  );

  const styles = useMemo(() => createStyles(theme), [theme]);
  const containerStyle = useMemo(
    () => [styles.container, { backgroundColor: theme.background }],
    [styles.container, theme.background],
  );

  return (
    <Portal.Host>
      <View style={containerStyle}>
        <Portal>
          {selected.length === 0 ? (
            <NovelAppbar
              novel={novel}
              deleteChapters={deleteDownloadedChapters}
              downloadChapters={downloadAvailableChapters}
              showEditInfoModal={showEditInfoModalHandler}
              setCustomNovelCover={setCustomNovelCover}
              downloadCustomChapterModal={openDlChapterModalHandler}
              showJumpToChapterModal={showJumpToChapterModalHandler}
              shareNovel={shareNovel}
              refreshNovel={onRefresh}
              editCategories={showSetCategoriesModalHandler}
              theme={theme}
              isLocal={novel?.isLocal ?? route.params?.isLocal ?? false}
              goBack={navigation.goBack}
              headerOpacity={headerOpacity}
            />
          ) : (
            <Animated.View
              entering={SlideInUp.duration(250)}
              exiting={SlideOutUp.duration(250)}
              style={styles.appbar}
            >
              <Appbar.Action
                icon="close"
                iconColor={theme.onBackground}
                onPress={clearSelection}
              />
              <Appbar.Content
                title={`${selected.length}`}
                titleStyle={titleStyle}
              />
              <Appbar.Action
                icon="select-all"
                iconColor={theme.onBackground}
                onPress={selectAll}
              />
            </Animated.View>
          )}
        </Portal>
        <SafeAreaView excludeTop>
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
        </SafeAreaView>

        {novel && categoriesModalMounted && setCategoriesModalVisible ? (
          <SetCategoryModal
            novelIds={[novel.id]}
            closeModal={closeSetCategoriesModal}
            visible
          />
        ) : null}

        <Portal>
          <Actionbar active={selected.length > 0} actions={selectionActions} />
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
          {novel ? (
            <>
              {jumpToChapterModalMounted ? (
                <JumpToChapterModal
                  modalVisible={jumpToChapterModal}
                  hideModal={hideJumpToChapterModal}
                  novel={novel}
                  chapterListRef={chapterListRef}
                  navigation={navigation}
                />
              ) : null}
              {editInfoModalMounted ? (
                <EditInfoModal
                  modalVisible={editInfoModal}
                  hideModal={hideEditInfoModal}
                  novel={novel}
                  setNovel={setNovel}
                  theme={theme}
                />
              ) : null}
              {dlChapterModalMounted ? (
                <DownloadCustomChapterModal
                  modalVisible={dlChapterModalVisible}
                  hideModal={closeDlChapterModal}
                  novel={novel}
                  chapters={chapters}
                  theme={theme}
                  downloadChapters={downloadChapters}
                />
              ) : null}
            </>
          ) : null}
        </Portal>
      </View>
    </Portal.Host>
  );
};

export default Novel;

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    appbar: {
      alignItems: 'center',
      backgroundColor: theme.surface2,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      flexDirection: 'row',
      paddingBottom: 8,
      paddingTop: StatusBar.currentHeight || 0,
      position: 'absolute',
      width: '100%',
    },
    container: { flex: 1 },
    rowBack: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    snackbar: { backgroundColor: theme.surface, marginBottom: 32 },
  });
}
