import * as React from 'react';
import ChapterItem from './ChapterItem';
import NovelInfoHeader from './Info/NovelInfoHeader';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ChapterInfo, NovelInfo } from '@database/types';
import { useAppSettings, useDownload, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import {
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackSheet from './Tracker/TrackSheet';
import NovelBottomSheet from './NovelBottomSheet';
import PageNavigationBottomSheet from './PageNavigationBottomSheet';
import * as Haptics from 'expo-haptics';
import { ChapterListSkeleton } from '@components/Skeleton/Skeleton';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { LegendListRef } from '@legendapp/list/react-native';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import PagePaginationControl from './PagePaginationControl';
import { useNovelActions, useNovelValue } from '../NovelContext';
import { UseBooleanReturnType } from '@hooks/index';
import { useCustomNovelCover } from '../hooks/useCustomNovelCover';
import { useSaveNovelCover } from '../hooks/useSaveNovelCover';
import { NovelScreenProps } from '@navigators/types';
import { useDownloadReconciliation } from '../hooks/useDownloadReconciliation';
import { useNovelRefresh } from '../hooks/useNovelRefresh';
import NovelFloatingActions from './NovelFloatingActions';

type NovelScreenListProps = {
  headerOpacity: SharedValue<number>;
  listRef: React.RefObject<LegendListRef | null>;
  navigation: Pick<NovelScreenProps['navigation'], 'navigate'>;
  selected: number[];
  setSelected: React.Dispatch<React.SetStateAction<number[]>>;
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
    getChapters,
    openPage,
    refreshNovel,
  } = useNovelActions();

  const routeNovel: Omit<NovelInfo, 'id'> & { id: 'NO_ID' } = {
    inLibrary: false,
    isLocal: false,
    totalPages: 0,
    ...routeBaseNovel,
    id: 'NO_ID',
  };
  const novel = fetchedNovel ?? routeNovel;
  const {
    useFabForContinueReading,
    disableHapticFeedback,
    downloadNewChapters,
    refreshNovelMetadata,
  } = useAppSettings();

  const { filter, showChapterTitles = false } = novelSettings;

  const theme = useTheme();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const {
    downloadingChapterIds,
    downloadingNovelIds,
    downloadChapter,
    enqueueTasks,
  } = useDownload();

  // Queue removal can mean success, failure, or cancellation. Reconcile once
  // after this novel's queue settles instead of reloading for every task.
  const isNovelDownloading =
    novel.id !== 'NO_ID' && downloadingNovelIds.has(novel.id);
  useDownloadReconciliation(isNovelDownloading, getChapters);

  const [isFabExtended, setIsFabExtended] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollOffset = useSharedValue(0);
  const { height: screenHeight } = useWindowDimensions();

  const novelBottomSheetRef = useRef<BottomSheetModalMethods>(null);
  const trackerSheetRef = useRef<BottomSheetModalMethods>(null);
  const pageNavigationSheetRef = useRef<BottomSheetModalMethods>(null);

  // Derive selectedIds Set for O(1) lookups
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const isSelectionMode = selected.length > 0;
  const hasDownloadedChapters = useMemo(
    () => chapters.some(chapter => chapter.isDownloaded),
    [chapters],
  );

  useAnimatedReaction(
    () => scrollOffset.value,
    (currentOffset, previousOffset) => {
      headerOpacity.set(
        currentOffset < 50 ? 0 : Math.min((currentOffset - 50) / 150, 1),
      );

      if (previousOffset === null) {
        return;
      }

      if (useFabForContinueReading && lastRead) {
        const isExtended = currentOffset <= 0;
        if (isExtended !== previousOffset <= 0) {
          runOnJS(setIsFabExtended)(isExtended);
        }
      }

      const shouldShowScrollToTop = currentOffset > screenHeight / 2;
      if (shouldShowScrollToTop !== previousOffset > screenHeight / 2) {
        runOnJS(setShowScrollToTop)(shouldShowScrollToTop);
      }
    },
    [headerOpacity, lastRead, screenHeight, useFabForContinueReading],
  );

  const listSharedValues = useMemo(() => ({ scrollOffset }), [scrollOffset]);

  // --- Stable callbacks ---

  const navigateToChapter = useCallback(
    (chapter: ChapterInfo) => {
      if (!fetchedNovel) {
        return;
      }
      navigation.navigate('ReaderStack', {
        screen: 'Chapter',
        params: { novel: fetchedNovel, chapter },
      });
    },
    [navigation, fetchedNovel],
  );

  const onSelectPress = useCallback(
    (chapter: ChapterInfo) => {
      if (!isSelectionMode) {
        navigateToChapter(chapter);
      } else {
        setSelected(sel =>
          sel.includes(chapter.id)
            ? sel.filter(id => id !== chapter.id)
            : [...sel, chapter.id],
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
          return [...sel, chapter.id];
        }
        if (sel.length === chapters.length) {
          return sel;
        }

        const lastSelectedChapterId = sel[sel.length - 1];
        if (lastSelectedChapterId === chapter.id) {
          return sel;
        }

        const lowerId = Math.min(lastSelectedChapterId, chapter.id);
        const upperId = Math.max(lastSelectedChapterId, chapter.id);
        return Array.from(
          new Set([
            ...sel,
            ...chapters
              .filter(chap => chap.id >= lowerId && chap.id <= upperId)
              .map(chap => chap.id),
          ]),
        );
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

  const { updating, refresh: onRefresh } = useNovelRefresh({
    novel: novel.id === 'NO_ID' ? undefined : novel,
    downloadNewChapters,
    refreshNovelMetadata,
    reloadNovel: refreshNovel,
    enqueue: enqueueTasks,
  });

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

  const setCustomNovelCover = useCustomNovelCover(
    novel.id === 'NO_ID' ? undefined : novel,
    setNovel,
  );
  const saveNovelCover = useSaveNovelCover(
    novel.id === 'NO_ID' ? undefined : novel,
  );

  const onFabPress = useCallback(() => {
    const chapter = lastRead ?? firstUnreadChapter;
    if (chapter && fetchedNovel) {
      navigation.navigate('ReaderStack', {
        screen: 'Chapter',
        params: { novel: fetchedNovel, chapter },
      });
    }
  }, [lastRead, firstUnreadChapter, fetchedNovel, navigation]);

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
          hasDownloadedChapters={hasDownloadedChapters}
          deleteDownloadSnackbar={deleteDownloadSnackbar}
          fetching={fetching}
          filter={filter}
          firstUnreadChapter={firstUnreadChapter}
          isLoading={loading}
          lastRead={lastRead}
          navigateToChapter={navigateToChapter}
          novel={novel}
          novelBottomSheetRef={novelBottomSheetRef}
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
      hasDownloadedChapters,
      deleteDownloadSnackbar,
      fetching,
      filter,
      firstUnreadChapter,
      loading,
      lastRead,
      navigateToChapter,
      novel,
      setCustomNovelCover,
      saveNovelCover,
      theme,
      batchInformation.totalChapters,
      paginationControl,
    ],
  );

  const continueFabLabel = useMemo(
    () =>
      lastRead
        ? getString('common.resume')
        : getString('novelScreen.startReadingChapters', { name: '' }).trim(),
    [lastRead],
  );

  const renderChapter = useCallback(
    ({ item }: { item: ChapterInfo }) => {
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
    },
    [
      downloadingChapterIds,
      handleDeleteChapter,
      handleDownloadChapter,
      novel,
      onSelectLongPress,
      onSelectPress,
      selectedIds,
      showChapterTitles,
      theme,
    ],
  );
  const listExtraData = useMemo(
    () => ({ downloadingChapterIds, selectedIds }),
    [downloadingChapterIds, selectedIds],
  );

  return (
    <>
      <AnimatedLegendList
        ref={listRef}
        estimatedItemSize={64}
        data={chapters}
        recycleItems
        ListEmptyComponent={listEmptyComponent}
        renderItem={renderChapter}
        keyExtractor={chapterKeyExtractor}
        extraData={listExtraData}
        contentContainerStyle={styles.contentContainer}
        refreshControl={refreshControlElement}
        onEndReached={getNextChapterBatch}
        onEndReachedThreshold={6}
        sharedValues={listSharedValues}
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
          <NovelFloatingActions
            bottomInset={bottomInset}
            continueLabel={continueFabLabel}
            isContinueExtended={isFabExtended}
            loading={loading}
            onContinue={onFabPress}
            onScrollToTop={scrollToTop}
            showContinue={
              useFabForContinueReading &&
              Boolean(lastRead || firstUnreadChapter)
            }
            showScrollToTop={showScrollToTop}
            theme={theme}
          />
        </>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 100 },
  rowBack: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default React.memo(NovelScreenList);
