import * as React from 'react';
import ChapterItem from './ChapterItem';
import NovelInfoHeader from './Info/NovelInfoHeader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pickCustomNovelCover } from '@database/queries/NovelQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import {
  useAppSettings,
  useDownload,
  useTheme,
} from '@hooks/persisted';
import {
  updateNovel,
  updateNovelPage,
} from '@services/updates/LibraryUpdateQueries';
import { getString } from '@strings/translations';
import { showToast } from '@utils/showToast';
import {
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackSheet from './Tracker/TrackSheet';
import NovelBottomSheet from './NovelBottomSheet';
import PageNavigationBottomSheet from './PageNavigationBottomSheet';
import * as Haptics from 'expo-haptics';
import { AnimatedFAB } from 'react-native-paper';
import { ChapterListSkeleton } from '@components/Skeleton/Skeleton';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { LegendList, LegendListRef } from '@legendapp/list';
import FileManager from '@specs/NativeFile';
import { downloadFile } from '@plugins/helpers/fetch';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import PagePaginationControl from './PagePaginationControl';
import { useNovelActions, useNovelValue } from '../NovelContext';
import { UseBooleanReturnType } from '@hooks/index';

type NovelScreenListProps = {
  headerOpacity: SharedValue<number>;
  listRef: React.RefObject<LegendListRef | null>;
  navigation: any;
  selected: ChapterInfo[];
  setSelected: React.Dispatch<React.SetStateAction<ChapterInfo[]>>;
  routeBaseNovel: {
    name: string;
    path: string;
    pluginId: string;
    cover?: string | null;
  };
  deleteDownloadSnackbar?: UseBooleanReturnType;
};

const chapterKeyExtractor = (item: ChapterInfo) => 'c' + item.id;

const NovelScreenList = ({
  headerOpacity,
  listRef,
  navigation,
  routeBaseNovel,
  selected,
  setSelected,
  deleteDownloadSnackbar,
}: NovelScreenListProps) => {
  const chapters = useNovelValue('chapters');
  const fetching = useNovelValue('fetching');
  const firstUnreadChapter = useNovelValue('firstUnreadChapter');
  const loading = useNovelValue('loading');
  const pages = useNovelValue('pages');
  const fetchedNovel = useNovelValue('novel');
  const batchInformation = useNovelValue('batchInformation');
  const novelSettings = useNovelValue('novelSettings');
  const pageIndex = useNovelValue('pageIndex');
  const lastRead = useNovelValue('lastRead');
  const {
    deleteChapter,
    setNovel,
    getNextChapterBatch,
    openPage,
    updateChapter,
    refreshNovel,
  } = useNovelActions();

  const { pluginId } = routeBaseNovel;
  const routeNovel: Omit<NovelInfo, 'id'> & { id: 'NO_ID' } = {
    inLibrary: false,
    isLocal: false,
    totalPages: 0,
    ...routeBaseNovel,
    id: 'NO_ID',
  };
  const novel = fetchedNovel ?? routeNovel;
  const [updating, setUpdating] = useState(false);
  const {
    useFabForContinueReading,
    disableHapticFeedback,
    downloadNewChapters,
    refreshNovelMetadata,
  } = useAppSettings();

  const { filter, showChapterTitles = false } = novelSettings;

  const theme = useTheme();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const { downloadingChapterIds, downloadChapter } = useDownload();

  // Mark chapters as downloaded when their download completes
  const prevDownloadingRef = useRef(downloadingChapterIds);
  useEffect(() => {
    const prev = prevDownloadingRef.current;
    prevDownloadingRef.current = downloadingChapterIds;
    if (prev === downloadingChapterIds) {
      return;
    }
    for (const id of prev) {
      if (!downloadingChapterIds.has(id)) {
        const index = chapters.findIndex(c => c.id === id);
        if (index !== -1) {
          updateChapter(index, { isDownloaded: true });
        }
      }
    }
  }, [downloadingChapterIds, chapters, updateChapter]);

  const [isFabExtended, setIsFabExtended] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const novelBottomSheetRef = useRef<BottomSheetModalMethods>(null);
  const trackerSheetRef = useRef<BottomSheetModalMethods>(null);
  const pageNavigationSheetRef = useRef<BottomSheetModalMethods>(null);

  // Derive selectedIds Set for O(1) lookups
  const selectedIds = useMemo(
    () => new Set(selected.map(s => s.id)),
    [selected],
  );
  const isSelectionMode = selected.length > 0;

  const onPageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;

      headerOpacity.set(y < 50 ? 0 : (y - 50) / 150);
      const currentScrollPosition = Math.floor(y) ?? 0;
      if (useFabForContinueReading && lastRead) {
        setIsFabExtended(currentScrollPosition <= 0);
      }

      const screenHeight = Dimensions.get('window').height;
      setShowScrollToTop(currentScrollPosition > screenHeight / 2);
    },
    [headerOpacity, useFabForContinueReading, lastRead],
  );

  // --- Stable callbacks ---

  const navigateToChapter = useCallback(
    (chapter: ChapterInfo) => {
      navigation.navigate('ReaderStack', {
        screen: 'Chapter',
        params: { novel, chapter },
      });
    },
    [navigation, novel],
  );

  const onSelectPress = useCallback(
    (chapter: ChapterInfo) => {
      if (!isSelectionMode) {
        navigateToChapter(chapter);
      } else {
        setSelected(sel =>
          sel.some(it => it.id === chapter.id)
            ? sel.filter(it => it.id !== chapter.id)
            : [...sel, chapter],
        );
      }
    },
    [isSelectionMode, navigateToChapter, setSelected],
  );

  const onSelectLongPress = useCallback(
    (chapter: ChapterInfo) => {
      setSelected(sel => {
        if (sel.length === 0) {
          if (!disableHapticFeedback) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          return [...sel, chapter];
        }
        if (sel.length === chapters.length) {
          return sel;
        }

        const lastSelectedChapter = sel[sel.length - 1];
        if (lastSelectedChapter.id === chapter.id) {
          return sel;
        }

        if (lastSelectedChapter.id > chapter.id) {
          return [
            ...sel,
            chapter,
            ...chapters.filter(
              (chap: ChapterInfo) =>
                (chap.id <= chapter.id || chap.id >= lastSelectedChapter.id) ===
                false,
            ),
          ];
        }
        return [
          ...sel,
          chapter,
          ...chapters.filter(
            (chap: ChapterInfo) =>
              (chap.id >= chapter.id || chap.id <= lastSelectedChapter.id) ===
              false,
          ),
        ];
      });
    },
    [chapters, disableHapticFeedback, setSelected],
  );

  const handleDeleteChapter = useCallback(
    (chapter: ChapterInfo) => {
      deleteChapter(chapter);
    },
    [deleteChapter],
  );

  const handleDownloadChapter = useCallback(
    (chapter: ChapterInfo) => {
      if (novel && novel.id !== 'NO_ID') {
        downloadChapter(novel, chapter);
      }
    },
    [novel, downloadChapter],
  );

  const onRefresh = useCallback(async () => {
    if (novel.id !== 'NO_ID') {
      setUpdating(true);
      updateNovel(pluginId, novel.path, novel.id, {
        downloadNewChapters,
        refreshNovelMetadata,
      })
        .then(() => refreshNovel())
        .then(() =>
          showToast(
            getString('novelScreen.updatedToast', { name: novel.name }),
          ),
        )
        .catch(error => showToast('Failed updating: ' + error.message))
        .finally(() => setUpdating(false));
    }
  }, [
    novel,
    pluginId,
    downloadNewChapters,
    refreshNovelMetadata,
    refreshNovel,
  ]);

  const onRefreshPage = useCallback(
    async (page: string) => {
      if (novel.id !== 'NO_ID') {
        setUpdating(true);
        updateNovelPage(pluginId, novel.path, novel.path, novel.id, page, {
          downloadNewChapters,
        })
          .then(() => refreshNovel())
          .then(() => showToast(`Updated page: ${page}`))
          .catch(e => showToast('Failed updating: ' + e.message))
          .finally(() => setUpdating(false));
      }
    },
    [novel, pluginId, downloadNewChapters, refreshNovel],
  );

  const refreshControlElement = useMemo(
    () => (
      <RefreshControl
        progressViewOffset={topInset + 32}
        onRefresh={onRefresh}
        refreshing={updating}
        colors={[theme.primary]}
        progressBackgroundColor={theme.onPrimary}
      />
    ),
    [onRefresh, updating, topInset, theme.primary, theme.onPrimary],
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [listRef]);

  const setCustomNovelCover = useCallback(async () => {
    if (!novel || novel.id === 'NO_ID') {
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

  const saveNovelCover = useCallback(async () => {
    if (!novel) {
      showToast(getString('novelScreen.coverNotSaved'));
      return;
    }
    if (!novel.cover) {
      showToast(getString('novelScreen.noCoverFound'));
      return;
    }
    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      showToast(getString('novelScreen.coverNotSaved'));
      return;
    }
    const cover = novel.cover;
    let tempCoverUri: string | null = null;
    try {
      let imageExtension = cover.split('.').pop() || 'png';
      if (imageExtension.includes('?')) {
        imageExtension = imageExtension.split('?')[0] || 'png';
      }
      imageExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(
        imageExtension || '',
      )
        ? imageExtension
        : 'png';

      const novelName = novel.name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${novelName}_${novel.id}.${imageExtension}`;
      const coverDestUri = await StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        'image/' + imageExtension,
      );
      if (cover.startsWith('http')) {
        const { ExternalCachesDirectoryPath } = FileManager.getConstants();
        tempCoverUri = ExternalCachesDirectoryPath + '/' + fileName;
        await downloadFile(cover, tempCoverUri);
        FileManager.copyFile(tempCoverUri, coverDestUri);
      } else {
        FileManager.copyFile(cover, coverDestUri);
      }
      showToast(getString('novelScreen.coverSaved'));
    } catch (err: any) {
      showToast(err.message);
    } finally {
      if (tempCoverUri) {
        FileManager.unlink(tempCoverUri);
      }
    }
  }, [novel]);

  const onFabPress = useCallback(() => {
    const chapter = lastRead ?? firstUnreadChapter;
    if (chapter) {
      navigation.navigate('ReaderStack', {
        screen: 'Chapter',
        params: { novel, chapter },
      });
    }
  }, [lastRead, firstUnreadChapter, novel, navigation]);

  const hasMultiplePages = pages.length > 1 || (novel?.totalPages ?? 0) > 1;

  const openPageNavDrawer = useCallback(
    () => pageNavigationSheetRef.current?.present(),
    [],
  );

  // --- Memoized list components ---

  const paginationControl = useMemo(() => {
    if (!hasMultiplePages) {
      return null;
    }
    return (
      <View>
        <PagePaginationControl
          pages={pages}
          currentPageIndex={pageIndex}
          onPageChange={openPage}
          onOpenDrawer={openPageNavDrawer}
          theme={theme}
        />
      </View>
    );
  }, [hasMultiplePages, pages, pageIndex, openPage, openPageNavDrawer, theme]);

  const listEmptyComponent = useMemo(
    () => (fetching ? <ChapterListSkeleton /> : null),
    [fetching],
  );

  const listHeader = useMemo(
    () => (
      <>
        <NovelInfoHeader
          chapters={chapters}
          deleteDownloadSnackbar={deleteDownloadSnackbar}
          fetching={fetching}
          filter={filter}
          firstUnreadChapter={firstUnreadChapter}
          isLoading={loading}
          lastRead={lastRead}
          navigateToChapter={navigateToChapter}
          navigation={navigation}
          novel={novel}
          novelBottomSheetRef={novelBottomSheetRef}
          onRefreshPage={onRefreshPage}
          page={pages.length > 1 ? pages[pageIndex] : undefined}
          pageIndex={pageIndex}
          pages={pages}
          pageNavigationSheetRef={pageNavigationSheetRef}
          setCustomNovelCover={setCustomNovelCover}
          saveNovelCover={saveNovelCover}
          theme={theme}
          totalChapters={batchInformation.totalChapters}
          trackerSheetRef={trackerSheetRef}
        />
        {paginationControl}
      </>
    ),
    [
      chapters,
      deleteDownloadSnackbar,
      fetching,
      filter,
      firstUnreadChapter,
      loading,
      lastRead,
      navigateToChapter,
      navigation,
      novel,
      onRefreshPage,
      pages,
      pageIndex,
      setCustomNovelCover,
      saveNovelCover,
      theme,
      batchInformation.totalChapters,
      paginationControl,
    ],
  );

  const scrollToTopFabStyle = useMemo(
    () => [
      styles.scrollToTopFab,
      { backgroundColor: theme.surface2, marginBottom: bottomInset },
    ],
    [theme.surface2, bottomInset],
  );

  const continueFabStyle = useMemo(
    () => [
      styles.fab,
      { backgroundColor: theme.primary, marginBottom: bottomInset },
    ],
    [theme.primary, bottomInset],
  );

  const continueFabLabel = useMemo(
    () =>
      lastRead
        ? getString('common.resume')
        : getString('novelScreen.startReadingChapters', { name: '' }).trim(),
    [lastRead],
  );

  return (
    <>
      <LegendList
        ref={listRef}
        estimatedItemSize={64}
        data={chapters}
        recycleItems
        ListEmptyComponent={listEmptyComponent}
        renderItem={({ item }) => {
          if (novel.id === 'NO_ID') {
            return null;
          }
          return (
            <ChapterItem
              chapter={item}
              isDownloading={downloadingChapterIds.has(item.id)}
              isBookmarked={!!item.bookmark}
              isLocal={novel.isLocal ?? false}
              theme={theme}
              showChapterTitles={showChapterTitles}
              isSelected={selectedIds.has(item.id)}
              novelName={novel.name}
              onDeleteChapter={handleDeleteChapter}
              onDownloadChapter={handleDownloadChapter}
              onSelectPress={onSelectPress}
              onSelectLongPress={onSelectLongPress}
            />
          );
        }}
        keyExtractor={chapterKeyExtractor}
        extraData={[downloadingChapterIds, selectedIds]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={refreshControlElement}
        onEndReached={getNextChapterBatch}
        onEndReachedThreshold={6}
        onScroll={onPageScroll}
        scrollEventThrottle={16}
        //drawDistance={1000}
        ListHeaderComponent={listHeader}
      />
      {novel.id !== 'NO_ID' ? (
        <>
          <NovelBottomSheet
            bottomSheetRef={novelBottomSheetRef}
            theme={theme}
          />
          <TrackSheet bottomSheetRef={trackerSheetRef} novel={novel} />
          {(novel.totalPages ?? 0) > 1 || pages.length > 1 ? (
            <PageNavigationBottomSheet
              bottomSheetRef={pageNavigationSheetRef}
              theme={theme}
              pages={pages}
              pageIndex={pageIndex}
              openPage={openPage}
            />
          ) : null}
          {showScrollToTop ? (
            <AnimatedFAB
              style={scrollToTopFabStyle}
              color={theme.primary}
              icon="arrow-up"
              label=""
              extended={false}
              onPress={scrollToTop}
              visible={showScrollToTop}
            />
          ) : null}
          {useFabForContinueReading && (lastRead || firstUnreadChapter) ? (
            <AnimatedFAB
              style={continueFabStyle}
              extended={isFabExtended && !loading}
              color={theme.onPrimary}
              uppercase={false}
              label={continueFabLabel}
              icon="play"
              onPress={onFabPress}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 100 },
  fab: {
    bottom: 16,
    margin: 16,
    position: 'absolute',
    right: 0,
  },
  rowBack: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrollToTopFab: {
    bottom: 16,
    position: 'absolute',
  },
});

export default React.memo(NovelScreenList);
