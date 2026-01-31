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
import { isNumber, noop } from 'lodash-es';
import NovelAppbar from './components/NovelAppbar';
import { resolveUrl } from '@services/plugin/fetch';
import {
  getAllUndownloadedAndUnreadChapters,
  getAllUndownloadedChapters,
  updateChapterProgressByIds,
} from '@database/queries/ChapterQueries';
import { MaterialDesignIconName } from '@type/icon';
import NovelScreenList from './components/NovelScreenList';
import { ThemeColors } from '@theme/types';
import { SafeAreaView } from '@components';
import { useNovelContext } from './NovelContext';
import { LegendListRef } from '@legendapp/list';

const Novel = ({ route, navigation }: NovelScreenProps) => {
  const {
    novel,
    chapters,
    fetching,
    batchInformation,
    getNextChapterBatch,
    loadUpToBatch,
    setNovel,
    bookmarkChapters,
    markChaptersRead,
    markChaptersUnread,
    markPreviouschaptersRead,
    markPreviousChaptersUnread,
    refreshChapters,
    deleteChapters,
  } = useNovelContext();

  const theme = useTheme();
  const { downloadChapters } = useDownload();

  const [selected, setSelected] = useState<ChapterInfo[]>([]);
  const [editInfoModal, showEditInfoModal] = useState(false);

  const chapterListRef = useRef<LegendListRef | null>(null);

  const deleteDownloadsSnackbar = useBoolean();

  const headerOpacity = useSharedValue(0);

  // TODO: fix this
  // useEffect(() => {
  //   if (chapters.length !== 0 && !fetching) {
  //     refreshChapters();
  //   }
  // }, [chapters.length, downloadQueue.length, fetching, refreshChapters]);

  // useFocusEffect(refreshChapters);

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
  const shareNovel = () => {
    if (!novel) {
      return;
    }
    Share.share({
      message: resolveUrl(novel.pluginId, novel.path, true),
    });
  };

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

  const setCustomNovelCover = async () => {
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
  };
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Portal.Host>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Portal>
          {selected.length === 0 ? (
            <NovelAppbar
              novel={novel}
              deleteChapters={deleteChs}
              downloadChapters={downloadChs}
              showEditInfoModal={showEditInfoModal}
              setCustomNovelCover={setCustomNovelCover}
              downloadCustomChapterModal={openDlChapterModal}
              showJumpToChapterModal={showJumpToChapterModal}
              shareNovel={shareNovel}
              theme={theme}
              isLocal={novel?.isLocal ?? route.params?.isLocal}
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
                onPress={() => setSelected([])}
              />
              <Appbar.Content
                title={`${selected.length}`}
                titleStyle={{ color: theme.onSurface }}
              />
              <Appbar.Action
                icon="select-all"
                iconColor={theme.onBackground}
                onPress={() => {
                  setSelected(chapters);
                }}
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
              getNextChapterBatch={
                batchInformation.batch < batchInformation.total && !fetching
                  ? getNextChapterBatch
                  : noop
              }
            />
          </Suspense>
        </SafeAreaView>

        <Portal>
          <Actionbar active={selected.length > 0} actions={actions} />
          <Snackbar
            visible={deleteDownloadsSnackbar.value}
            onDismiss={deleteDownloadsSnackbar.setFalse}
            action={{
              label: getString('common.delete'),
              onPress: () => {
                deleteChapters(chapters.filter(c => c.isDownloaded));
              },
            }}
            theme={{ colors: { primary: theme.primary } }}
            style={styles.snackbar}
          >
            <Text style={{ color: theme.onSurface }}>
              {getString('novelScreen.deleteMessage')}
            </Text>
          </Snackbar>
        </Portal>
        <Portal>
          {novel && (
            <>
              <JumpToChapterModal
                modalVisible={jumpToChapterModal}
                hideModal={() => showJumpToChapterModal(false)}
                novel={novel}
                chapterListRef={chapterListRef}
                navigation={navigation}
                loadUpToBatch={loadUpToBatch}
                totalChapters={batchInformation.totalChapters}
                chapters={chapters}
              />
              <EditInfoModal
                modalVisible={editInfoModal}
                hideModal={() => showEditInfoModal(false)}
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
          )}
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
