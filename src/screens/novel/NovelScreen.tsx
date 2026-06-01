import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, StatusBar, Text, Share } from 'react-native';
import Animated, {
  SlideInUp,
  SlideOutUp,
  useSharedValue,
} from 'react-native-reanimated';

import { Portal, Appbar, Snackbar } from 'react-native-paper';
import { useDownload, useTheme } from '@hooks/persisted';
import JumpToChapterModal from './components/JumpToChapterModal';
import { Actionbar } from '../../components/Actionbar/Actionbar';
import EditInfoModal from './components/EditInfoModal';
import { pickCustomNovelCover } from '../../database/queries/NovelQueries';
import DownloadCustomChapterModal from './components/DownloadCustomChapterModal';
import { useBoolean } from '@hooks';
import NovelScreenLoading from './components/LoadingAnimation/NovelScreenLoading';
import { NovelScreenProps } from '@navigators/types';
import { ChapterInfo } from '@database/types';
import { getString } from '@strings/translations';
import { isNumber } from 'lodash-es';
import NovelAppbar from './components/NovelAppbar';
import { resolveUrl } from '@services/plugin/fetch';
import ServiceManager from '@services/ServiceManager';
import { clearNovelTranslationCache } from '@utils/translate';
import { showToast } from '@utils/showToast';
import {
  getAllUndownloadedAndUnreadChapters,
  getAllUndownloadedChapters,
  updateChapterProgressByIds,
} from '@database/queries/ChapterQueries';
import { MaterialDesignIconName } from '@type/icon';
import NovelScreenList from './components/NovelScreenList';
import { ThemeColors } from '@theme/types';
import { SafeAreaView } from '@components';
import { useNovelActions, useNovelValue } from './NovelContext';
import { LegendListRef } from '@legendapp/list';

const Novel = ({ route, navigation }: NovelScreenProps) => {
  const novel = useNovelValue('novel');
  const chapters = useNovelValue('chapters');
  const {
    setNovel,
    bookmarkChapters,
    markChaptersRead,
    markChaptersUnread,
    markPreviouschaptersRead,
    markPreviousChaptersUnread,
    refreshChapters,
    deleteChapters,
  } = useNovelActions();

  const theme = useTheme();
  const { downloadChapters } = useDownload();

  const [selected, setSelected] = useState<ChapterInfo[]>([]);
  const [editInfoModal, showEditInfoModal] = useState(false);

  const chapterListRef = useRef<LegendListRef | null>(null);

  const deleteDownloadsSnackbar = useBoolean();

  const headerOpacity = useSharedValue(0);

  const downloadChs = useCallback(
    async (amount: number | 'all' | 'unread') => {
      if (!novel) {
        return;
      }

      let chaptersToUse = chapters;

      if (amount === 'all') {
        const allChapters = await getAllUndownloadedChapters(novel.id);
        chaptersToUse = allChapters;
      }

      if (amount === 'unread') {
        const allUnreadChapters = await getAllUndownloadedAndUnreadChapters(
          novel.id,
        );
        chaptersToUse = allUnreadChapters;
      }

      let filtered = chaptersToUse;

      if (isNumber(amount)) {
        filtered = filtered
          .filter(chapter => !chapter.isDownloaded)
          .slice(0, amount);
      }

      if (filtered.length > 0) {
        downloadChapters(novel, filtered);
      }
    },
    [chapters, downloadChapters, novel],
  );

  const deleteChs = useCallback(() => {
    deleteChapters(chapters.filter(c => c.isDownloaded));
  }, [chapters, deleteChapters]);

  const shareNovel = useCallback(() => {
    if (!novel) {
      return;
    }
    Share.share({
      message: resolveUrl(novel.pluginId, novel.path, true),
    });
  }, [novel]);

  const translateChs = useCallback(
    async (amount: 'all' | 'unread') => {
      if (!novel) return;
      let filtered = chapters;
      if (amount === 'unread') {
        filtered = chapters.filter(c => c.unread);
      }
      if (filtered.length > 0) {
        ServiceManager.manager.addTask({
          name: 'TRANSLATE_NOVEL',
          data: {
            novelId: novel.id,
            novelName: novel.name,
            chapterIds: filtered.map(c => c.id),
          },
        });
      }
    },
    [chapters, novel],
  );

  const clearNovelTranslations = useCallback(() => {
    if (!novel) return;
    clearNovelTranslationCache(chapters);
    showToast(getString('novelScreen.removeTranslationsSuccess'));
  }, [novel, chapters]);

  const [jumpToChapterModal, showJumpToChapterModal] = useState(false);
  const {
    value: dlChapterModalVisible,
    setTrue: openDlChapterModal,
    setFalse: closeDlChapterModal,
  } = useBoolean();

  const actions = useMemo(() => {
    const list: { icon: MaterialDesignIconName; onPress: () => void }[] = [];

    if (!novel?.isLocal && selected.some(obj => !obj.isDownloaded)) {
      list.push({
        icon: 'download-outline',
        onPress: () => {
          if (novel) {
            downloadChapters(
              novel,
              selected.filter(chapter => !chapter.isDownloaded),
            );
          }
          setSelected([]);
        },
      });
    }
    if (!novel?.isLocal && selected.some(obj => obj.isDownloaded)) {
      list.push({
        icon: 'trash-can-outline',
        onPress: () => {
          deleteChapters(selected.filter(chapter => chapter.isDownloaded));
          setSelected([]);
        },
      });
    }

    list.push({
      icon: 'bookmark-outline',
      onPress: () => {
        bookmarkChapters(selected);
        setSelected([]);
      },
    });

    if (selected.some(obj => obj.unread)) {
      list.push({
        icon: 'check',
        onPress: () => {
          markChaptersRead(selected);
          setSelected([]);
        },
      });
    }

    if (selected.some(obj => !obj.unread)) {
      const chapterIds = selected.map(chapter => chapter.id);

      list.push({
        icon: 'check-outline',
        onPress: () => {
          markChaptersUnread(selected);
          updateChapterProgressByIds(chapterIds, 0);
          setSelected([]);
          refreshChapters();
        },
      });
    }

    if (selected.length === 1) {
      if (selected[0].unread) {
        list.push({
          icon: 'playlist-check',
          onPress: () => {
            markPreviouschaptersRead(selected[0].id);
            setSelected([]);
          },
        });
      } else {
        list.push({
          icon: 'playlist-remove',
          onPress: () => {
            markPreviousChaptersUnread(selected[0].id);
            setSelected([]);
          },
        });
      }
    }

    return list;
  }, [
    bookmarkChapters,
    deleteChapters,
    downloadChapters,
    markChaptersRead,
    markChaptersUnread,
    markPreviousChaptersUnread,
    markPreviouschaptersRead,
    novel,
    refreshChapters,
    selected,
  ]);

  const setCustomNovelCover = useCallback(async () => {
    if (!novel) {
      return;
    }
    const newCover = await pickCustomNovelCover(novel);
    if (newCover) {
      setNovel({
        ...novel,
        cover: newCover,
      });
    }
  }, [novel, setNovel]);

  const hideJumpToChapterModal = useCallback(
    () => showJumpToChapterModal(false),
    [],
  );
  const hideEditInfoModal = useCallback(() => showEditInfoModal(false), []);
  const clearSelection = useCallback(() => setSelected([]), []);
  const selectAll = useCallback(() => setSelected(chapters), [chapters]);

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
              deleteChapters={deleteChs}
              downloadChapters={downloadChs}
              translateChapters={translateChs}
              clearNovelTranslations={clearNovelTranslations}
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
          <Actionbar active={selected.length > 0} actions={actions} />
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
