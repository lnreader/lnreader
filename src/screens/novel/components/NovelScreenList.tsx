import * as React from 'react';
import ChapterItem from './ChapterItem';
import NovelInfoHeader from './Info/NovelInfoHeader';
import { useCallback, useMemo, useState } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';
import { ChapterInfo, NovelInfo } from '@database/types';
import { useAppSettings, useDownload, useTheme } from '@hooks/persisted';
import { useWindowLayout } from '@hooks/common/useWindowLayout';
import { getString } from '@i18n/translations';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import {
  AppHost,
  ComposeList,
  OverlayHost,
  type ComposeListHandle,
} from '@components';
import PagePaginationControl from './PagePaginationControl';
import { useNovelActions, useNovelValue } from '../NovelContext';
import { UseBooleanReturnType } from '@hooks/index';
import { useCustomNovelCover } from '../hooks/useCustomNovelCover';
import { useSaveNovelCover } from '../hooks/useSaveNovelCover';
import { NovelScreenProps } from '@navigators/types';
import { useDownloadReconciliation } from '../hooks/useDownloadReconciliation';
import NovelFloatingActions from './NovelFloatingActions';
import { getDownloadProgressKey } from '@services/backgroundTasks/taskDefinitions';

const DETAILS_PANE_WIDTH = 400;

type NovelScreenListProps = {
  headerOpacity: SharedValue<number>;
  listRef: React.RefObject<ComposeListHandle | null>;
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

const chapterKeyExtractor = (item: ChapterInfo) => 'c' + item.id;

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
  const {
    deleteChapter,
    setNovel,
    getNextChapterBatch,
    getChapters,
    openPage,
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
    dateFormat = 'default',
    relativeTimestamps = true,
  } = useAppSettings();

  const { filter, showChapterTitles = false } = novelSettings;

  const theme = useTheme();
  const layout = useWindowLayout();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const {
    downloadQueue,
    downloadingChapterIds,
    downloadingNovelIds,
    downloadChapter,
  } = useDownload();

  // Reconcile as chapters complete and once more when the queue settles so
  // downloaded state remains accurate after success, failure, or cancellation.
  const isNovelDownloading =
    novel.id !== 'NO_ID' && downloadingNovelIds.has(novel.id);
  const novelDownloadProgressKey = useMemo(
    () =>
      novel.id === 'NO_ID'
        ? ''
        : getDownloadProgressKey(downloadQueue, novel.id),
    [downloadQueue, novel.id],
  );
  useDownloadReconciliation(
    isNovelDownloading,
    novelDownloadProgressKey,
    getChapters,
  );

  const [isFabExtended, setIsFabExtended] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollOffset = useSharedValue(0);
  const { height: screenHeight } = useWindowDimensions();

  const [novelBottomSheetVisible, setNovelBottomSheetVisible] = useState(false);
  const [trackerSheetVisible, setTrackerSheetVisible] = useState(false);
  const [pageNavigationSheetVisible, setPageNavigationSheetVisible] =
    useState(false);

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

  const scrollHandler = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.value = event.nativeEvent.contentOffset.y;
    },
    [scrollOffset],
  );

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

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToTop();
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
    () => setPageNavigationSheetVisible(true),
    [],
  );
  const openNovelBottomSheet = useCallback(
    () => setNovelBottomSheetVisible(true),
    [],
  );
  const openTrackerSheet = useCallback(() => setTrackerSheetVisible(true), []);

  // --- Memoized list components ---

  const paginationControl = useMemo(() => {
    if (!hasMultiplePages) {
      return null;
    }
    return (
      <PagePaginationControl
        pages={pages}
        currentPageIndex={pageIndex}
        onPageChange={openPage}
        onOpenDrawer={openPageNavDrawer}
        theme={theme}
      />
    );
  }, [hasMultiplePages, pages, pageIndex, openPage, openPageNavDrawer, theme]);

  const listEmptyComponent = useMemo(
    () => (fetching && chapters.length === 0 ? <ChapterListSkeleton /> : null),
    [chapters.length, fetching],
  );

  const novelInfoHeader = useMemo(
    () => (
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
        openNovelBottomSheet={openNovelBottomSheet}
        setCustomNovelCover={setCustomNovelCover}
        saveNovelCover={saveNovelCover}
        theme={theme}
        totalChapters={batchInformation.totalChapters}
        openTrackerSheet={openTrackerSheet}
        underTopBar={!layout.isExpanded}
      />
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
      openNovelBottomSheet,
      setCustomNovelCover,
      saveNovelCover,
      theme,
      batchInformation.totalChapters,
      openTrackerSheet,
      layout.isExpanded,
    ],
  );

  // On wide windows the novel details get their own pane beside the chapters.
  const sidePane = layout.isExpanded;
  const listHeader = useMemo(
    () =>
      [sidePane ? null : novelInfoHeader, paginationControl].filter(
        (element): element is React.JSX.Element => element !== null,
      ),
    [novelInfoHeader, paginationControl, sidePane],
  );

  const continueFabLabel = useMemo(
    () =>
      lastRead
        ? getString('common.resume')
        : getString('novelScreen.startReadingChapters', { name: '' }).trim(),
    [lastRead],
  );

  const renderChapter = useCallback(
    (item: ChapterInfo) => {
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
          dateFormat={dateFormat}
          relativeTimestamps={relativeTimestamps}
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
      dateFormat,
      relativeTimestamps,
    ],
  );
  const listExtraData = useMemo(
    () => ({ downloadingChapterIds, selectedIds }),
    [downloadingChapterIds, selectedIds],
  );

  const list = (
    <ComposeList
      ref={listRef}
      estimatedItemSize={64}
      data={chapters}
      footer={listEmptyComponent}
      renderItem={renderChapter}
      keyExtractor={chapterKeyExtractor}
      extraData={listExtraData}
      contentPadding={{ bottom: 100 + bottomInset }}
      refreshing={updating}
      onRefresh={onRefresh}
      onEndReached={getNextChapterBatch}
      onEndReachedThreshold={6}
      onScroll={scrollHandler}
      header={listHeader}
    />
  );

  return (
    <>
      {sidePane ? (
        <View style={styles.panes}>
          <AppHost
            style={{ width: Math.min(DETAILS_PANE_WIDTH, layout.width * 0.4) }}
          >
            <Column modifiers={[fillMaxSize(), verticalScroll()]}>
              {novelInfoHeader}
            </Column>
          </AppHost>
          <View
            style={[
              styles.chapters,
              { backgroundColor: theme.surfaceContainerLow },
            ]}
          >
            {list}
          </View>
        </View>
      ) : (
        list
      )}
      {novel.id !== 'NO_ID' ? (
        <>
          <OverlayHost>
            <NovelBottomSheet
              visible={novelBottomSheetVisible}
              onDismiss={() => setNovelBottomSheetVisible(false)}
              theme={theme}
            />
            <TrackSheet
              visible={trackerSheetVisible}
              onDismiss={() => setTrackerSheetVisible(false)}
              novel={novel}
            />
            {(novel.totalPages ?? 0) > 1 || pages.length > 1 ? (
              <PageNavigationBottomSheet
                visible={pageNavigationSheetVisible}
                onDismiss={() => setPageNavigationSheetVisible(false)}
                theme={theme}
                pages={pages}
                pageIndex={pageIndex}
                openPage={openPage}
              />
            ) : null}
          </OverlayHost>
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

const styles = StyleSheet.create({
  panes: { flex: 1, flexDirection: 'row' },
  chapters: { flex: 1, borderTopLeftRadius: 28, overflow: 'hidden' },
});
