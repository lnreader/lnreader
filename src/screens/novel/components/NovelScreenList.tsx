import * as React from 'react';
import NovelInfoHeader from './Info/NovelInfoHeader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChapterInfo, NovelInfo } from '@database/types';
import { useAppSettings, useDownload, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { useWindowDimensions, View } from 'react-native';
import {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackSheet from './Tracker/TrackSheet';
import NovelBottomSheet from './NovelBottomSheet';
import PageNavigationBottomSheet from './PageNavigationBottomSheet';
import * as Haptics from 'expo-haptics';
import { ChapterListSkeleton } from '@components/Skeleton/Skeleton';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import PagePaginationControl from './PagePaginationControl';
import { useNovelActions, useNovelValue } from '../NovelContext';
import { UseBooleanReturnType } from '@hooks/index';
import { useCustomNovelCover } from '../hooks/useCustomNovelCover';
import { useSaveNovelCover } from '../hooks/useSaveNovelCover';
import { NovelScreenProps } from '@navigators/types';
import { useDownloadReconciliation } from '../hooks/useDownloadReconciliation';
import NovelFloatingActions from './NovelFloatingActions';
import { getDownloadProgressKey } from '@services/backgroundTasks/taskDefinitions';
import { useBackgroundTasks } from '@hooks/persisted/useBackgroundTasks';
import {
  NativeChapterList,
  type NativeChapterListRef,
  useChapterListStore,
} from '@components/NativeChapterList';
import { CHAPTER_BATCH_SIZE } from '@hooks/persisted/useNovel/types';

type NovelScreenListProps = {
  headerOpacity: SharedValue<number>;
  listRef: React.RefObject<NativeChapterListRef | null>;
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
  onRefresh: () => void;
  updating: boolean;
};

const NO_CHAPTERS: ChapterInfo[] = [];
const NO_IDS = new Set<number>();

const NovelScreenList = ({
  headerOpacity,
  listRef,
  navigation,
  routeBaseNovel,
  selected,
  setSelected,
  deleteDownloadSnackbar,
  onRefresh,
  updating,
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
  const { deleteChapter, setNovel, getChapters, openPage, loadUpToBatch } =
    useNovelActions();

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
    reduceAppAnimations = false,
    dateFormat = 'default',
    relativeTimestamps = true,
  } = useAppSettings();

  const { filter, showChapterTitles = false } = novelSettings;

  const theme = useTheme();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const { downloadingChapterIds, downloadingNovelIds, downloadChapter } =
    useDownload();

  // Reconcile as chapters complete and once more when the queue settles so
  // downloaded state remains accurate after success, failure, or cancellation.
  const isNovelDownloading =
    novel.id !== 'NO_ID' && downloadingNovelIds.has(novel.id);
  const novelId = novel.id;
  const novelDownloadProgressKey = useBackgroundTasks(tasks =>
    novelId === 'NO_ID' ? '' : getDownloadProgressKey(tasks, novelId),
  );
  useDownloadReconciliation(
    isNovelDownloading,
    novelDownloadProgressKey,
    getChapters,
  );

  const [isFabExtended, setIsFabExtended] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  // Written on the UI thread by the native list's scroll events.
  const scrollOffset = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollOffset.set(event.contentOffset.y);
    },
  });
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

  // --- Native list data ---

  const hasNovel = novel.id !== 'NO_ID';
  const listChapters = hasNovel ? chapters : NO_CHAPTERS;
  const totalChapters = hasNovel
    ? Math.max(batchInformation.totalChapters ?? 0, chapters.length)
    : 0;

  // Page, sort, filter and scanlator changes replace the chapter list.
  const chapterSetKey = useMemo(
    () => JSON.stringify([novel.id, pageIndex, novelSettings]),
    [novel.id, pageIndex, novelSettings],
  );

  const chapterById = useMemo(
    () => new Map(chapters.map(chapter => [chapter.id, chapter])),
    [chapters],
  );

  // The furthest batch the native list has needed for this chapter set.
  // Reloads (e.g. getChapters after a download) drop back to the first batch
  // and cancel in-flight loads, so it's requested again until it's loaded.
  const neededBatch = useRef({ key: chapterSetKey, batch: -1 });
  const requestUpTo = useCallback(
    (index: number) => {
      const needed = neededBatch.current;
      if (needed.key !== chapterSetKey) {
        needed.key = chapterSetKey;
        needed.batch = -1;
      }
      const batch = Math.floor(index / CHAPTER_BATCH_SIZE);
      needed.batch = Math.max(needed.batch, batch);
      loadUpToBatch(batch);
    },
    [chapterSetKey, loadUpToBatch],
  );

  const storeId = useChapterListStore({
    chapters: listChapters,
    totalChapters,
    dataKey: chapterSetKey,
    format: { showChapterTitles, dateFormat, relativeTimestamps },
    selectedIds,
    downloadingIds: hasNovel ? downloadingChapterIds : NO_IDS,
    onStaleRows: (_start, end) => requestUpTo(end - 1),
  });

  // Unloaded rows ask for their range; loading a batch loads all before it.
  const onRequestRange = useCallback(
    (_start: number, end: number) => requestUpTo(end),
    [requestUpTo],
  );

  const loadedBatch = batchInformation.batch;
  useEffect(() => {
    const needed = neededBatch.current;
    if (
      !fetching &&
      needed.key === chapterSetKey &&
      needed.batch > loadedBatch
    ) {
      loadUpToBatch(needed.batch);
    }
  }, [chapterSetKey, fetching, loadedBatch, loadUpToBatch]);

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

  const withChapter = useCallback(
    (handler: (chapter: ChapterInfo) => void) => (id: number) => {
      const chapter = chapterById.get(id);
      if (chapter) {
        handler(chapter);
      }
    },
    [chapterById],
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({
      offset: 0,
      animated: !reduceAppAnimations,
    });
  }, [listRef, reduceAppAnimations]);

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

  const showSkeleton = fetching && listChapters.length === 0;

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
        {showSkeleton ? <ChapterListSkeleton /> : null}
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
      showSkeleton,
    ],
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
      <NativeChapterList
        ref={listRef}
        storeId={storeId}
        theme={theme}
        header={listHeader}
        isLocal={novel.isLocal ?? false}
        refreshing={updating}
        refreshOffset={topInset + 32}
        contentPaddingBottom={100 + bottomInset}
        fastScrollTopInset={topInset + 56}
        fastScrollBottomInset={bottomInset + 16}
        batchSize={CHAPTER_BATCH_SIZE}
        onScroll={scrollHandler}
        onRefresh={onRefresh}
        onChapterPress={withChapter(onSelectPress)}
        onChapterLongPress={withChapter(onSelectLongPress)}
        onDownloadPress={withChapter(handleDownloadChapter)}
        onDeletePress={withChapter(handleDeleteChapter)}
        onRequestRange={onRequestRange}
      />
      {hasNovel ? (
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

export default React.memo(NovelScreenList);
