import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, StatusBar, Text } from 'react-native';
import Animated, {
  SlideInUp,
  SlideOutUp,
  useSharedValue,
} from 'react-native-reanimated';

import { Portal, Appbar, Snackbar } from 'react-native-paper';
import { useTheme } from '@hooks/persisted';
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

const Novel = ({ route, navigation }: NovelScreenProps) => {
  const novel = useNovelValue('novel');
  const chapters = useNovelValue('chapters');
  const { setNovel, deleteChapters } = useNovelActions();

  const theme = useTheme();

  const {
    selectedIds: selected,
    selectedChapters,
    setSelectedIds: setSelected,
    clearSelection,
    selectAll,
  } = useChapterSelection(chapters);
  const [editInfoModal, showEditInfoModal] = useState(false);

  const chapterListRef = useRef<LegendListRef | null>(null);

  const deleteDownloadsSnackbar = useBoolean();

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
    selectedChapters,
  });

  const setCustomNovelCover = useCustomNovelCover(novel, setNovel);

  const hideJumpToChapterModal = useCallback(
    () => showJumpToChapterModal(false),
    [],
  );
  const hideEditInfoModal = useCallback(() => showEditInfoModal(false), []);
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
              showEditInfoModal={showEditInfoModal}
              setCustomNovelCover={setCustomNovelCover}
              downloadCustomChapterModal={openDlChapterModal}
              showJumpToChapterModal={showJumpToChapterModal}
              shareNovel={shareNovel}
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
            />
          </Suspense>
        </SafeAreaView>

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
