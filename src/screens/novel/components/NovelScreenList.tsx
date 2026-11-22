import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChapterInfo, NovelInfo } from '@database/types';
import { useAppSettings, useDownload, useTheme } from '@hooks/persisted';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackSheet from './Tracker/TrackSheet';
import PageNavigationBottomSheet from './PageNavigationBottomSheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useNovelActions, useNovelValue } from '../NovelContext';
import { UseBooleanReturnType } from '@hooks/index';
import { useCustomNovelCover } from '../hooks/useCustomNovelCover';
import { useSaveNovelCover } from '../hooks/useSaveNovelCover';
import { NovelScreenProps } from '@navigators/types';
import { useDownloadReconciliation } from '../hooks/useDownloadReconciliation';
import { getDownloadProgressKey } from '@services/backgroundTasks/taskDefinitions';
import { useBackgroundTasks } from '@hooks/persisted/useBackgroundTasks';
import {
  buildChapterRowFormat,
  NativeChapterList,
  type NativeChapterListRef,
  useChapterBatchRequests,
  useChapterListStore,
} from '@components/NativeChapterList';
import { CHAPTER_BATCH_SIZE } from '@hooks/persisted/useNovel/types';
import {
  getChapter,
  getPageChapterIds,
} from '@database/queries/ChapterQueries';
import type {
  ChapterSelectionResult,
  NovelActionEvent,
} from '@modules/nitro-chapter-list';
import { showToast } from '@utils/showToast';
import { getErrorMessage } from '@utils/error';
import { useNativeChapterControls } from '../hooks/useNativeChapterControls';
import {
  useNativeNovelDetails,
  type NovelAction,
} from '../hooks/useNativeNovelDetails';

type NovelScreenListProps = {
  toolbar?: readonly NovelAction[];
  selectionActions?: readonly NovelAction[];
  selectionToolbar?: readonly NovelAction[];
  onSelectionAction?: (
    action: string,
    ids: readonly number[],
    chapterId?: number,
  ) => Promise<void>;
  onEditCategories?: () => void;
  error?: string;
  listRef: React.RefObject<NativeChapterListRef | null>;
  navigation: Pick<NovelScreenProps['navigation'], 'navigate'>;
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
const NO_ACTIONS: readonly NovelAction[] = [];

const useOnDemandSheet = (enabled: boolean) => {
  const ref = useRef<BottomSheetModalMethods>(null);
  const [mounted, setMounted] = useState(false);

  const open = useCallback(() => {
    if (!enabled) {
      return;
    }
    if (ref.current) {
      ref.current.present();
    } else {
      setMounted(true);
    }
  }, [enabled]);

  useEffect(() => {
    if (mounted) {
      // The modal's imperative handle is available after the first commit.
      ref.current?.present();
    }
  }, [mounted]);

  return { ref, mounted: enabled && mounted, open };
};

const NovelScreenList = ({
  toolbar = NO_ACTIONS,
  selectionActions = NO_ACTIONS,
  selectionToolbar = NO_ACTIONS,
  onSelectionAction,
  onEditCategories,
  error,
  listRef,
  navigation,
  routeBaseNovel,
  deleteDownloadSnackbar,
  onRefresh,
  updating,
}: NovelScreenListProps) => {
  const chapters = useNovelValue('chapters');
  const fetching = useNovelValue('fetching');
  const firstUnreadChapter = useNovelValue('firstUnreadChapter');
  const loading = useNovelValue('loading');
  const pages = useNovelValue('pages');
  const scanlators = useNovelValue('scanlators');
  const fetchedNovel = useNovelValue('novel');
  const batchInformation = useNovelValue('batchInformation');
  const novelSettings = useNovelValue('novelSettings');
  const pageIndex = useNovelValue('pageIndex');
  const lastRead = useNovelValue('lastRead');
  const {
    deleteChapter,
    setNovel,
    syncDownloadedChapters,
    openPage,
    loadUpToBatch,
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
    disableHapticFeedback,
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
  // Only the downloaded flags change; reloading the list here would drop it
  // back to the first batch after every chapter.
  const isNovelDownloading =
    novel.id !== 'NO_ID' && downloadingNovelIds.has(novel.id);
  const novelId = novel.id;
  const novelDownloadProgressKey = useBackgroundTasks(tasks =>
    novelId === 'NO_ID' ? '' : getDownloadProgressKey(tasks, novelId),
  );
  useDownloadReconciliation(
    isNovelDownloading,
    novelDownloadProgressKey,
    syncDownloadedChapters,
  );

  const hasDownloadedChapters = useMemo(
    () => chapters.some(chapter => chapter.isDownloaded),
    [chapters],
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
  const selectionKey = JSON.stringify([
    novel.id,
    pages[pageIndex],
    filter,
    novelSettings.excludedScanlators,
  ]);

  const requestUpTo = useChapterBatchRequests({
    chapterSetKey,
    fetching,
    loadedBatch: batchInformation.batch,
    loadUpToBatch,
  });

  const rowFormat = useMemo(
    () =>
      buildChapterRowFormat({
        showChapterTitles,
        dateFormat,
        relativeTimestamps,
      }),
    [showChapterTitles, dateFormat, relativeTimestamps],
  );

  const storeId = useChapterListStore({
    chapters: listChapters,
    totalChapters,
    dataKey: chapterSetKey,
    downloadingIds: hasNovel ? downloadingChapterIds : NO_IDS,
    onStaleRows: (_start, end) => requestUpTo(end - 1),
  });

  // Unloaded rows ask for their range; loading a batch loads all before it.
  const onRequestRange = useCallback(
    (_start: number, end: number) => requestUpTo(end),
    [requestUpTo],
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

  // Native rows carry their position, and loaded chapters are the start of
  // the list, so a row is almost always chapters[position]. Rows native kept
  // from before a reload may not be loaded in JS yet; read those from the DB.
  const withChapter = useCallback(
    (handler: (chapter: ChapterInfo) => void) =>
      (id: number, position: number) => {
        const chapter =
          chapters[position]?.id === id
            ? chapters[position]
            : chapters.find(item => item.id === id);
        if (chapter) {
          handler(chapter);
          return;
        }
        void getChapter(id).then(row => {
          if (row) {
            handler(row as ChapterInfo);
          }
        });
      },
    [chapters],
  );

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

  const hasMultiplePages = pages.length > 1 || (novel.totalPages ?? 0) > 1;
  const {
    ref: trackerSheetRef,
    mounted: trackerSheetMounted,
    open: openTrackerSheet,
  } = useOnDemandSheet(hasNovel);
  const {
    ref: pageNavigationSheetRef,
    mounted: pageNavigationSheetMounted,
    open: openPageNavigationSheet,
  } = useOnDemandSheet(hasNovel && hasMultiplePages);

  const { details, onAction } = useNativeNovelDetails({
    novel,
    theme,
    loading,
    fetching,
    error,
    totalChapters: batchInformation.totalChapters,
    hasFilters: Boolean(filter?.length),
    hasDownloadedChapters,
    snackbar: deleteDownloadSnackbar,
    selectionKey,
    selectionHaptics: !disableHapticFeedback,
    selectionToolbar,
    toolbar,
    selectionActions,
    pages,
    pageIndex,
    lastRead,
    firstUnreadChapter,
    onRead: navigateToChapter,
    onResume: onFabPress,
    onOpenPage: openPage,
    onPages: openPageNavigationSheet,
    onTracker: openTrackerSheet,
    onEditCategories,
    onEditCover: setCustomNovelCover,
    onSaveCover: saveNovelCover,
  });

  const chapterControls = useNativeChapterControls({
    novelId: fetchedNovel?.id,
    settings: novelSettings,
    scanlators,
    totalChapters: batchInformation.totalChapters,
    dateFormat,
    relativeTimestamps,
    onOpenChapter: navigateToChapter,
  });

  const [selectionResult, setSelectionResult] =
    useState<ChapterSelectionResult>();
  const handleNovelAction = (event: NovelActionEvent) => {
    if (chapterControls.handle(event)) return;
    const { action, requestId, selectedIds, chapterId } = event;
    if (action === 'select-all' && requestId !== undefined && fetchedNovel) {
      void getPageChapterIds(
        fetchedNovel.id,
        filter,
        pages[pageIndex],
        novelSettings.excludedScanlators,
      )
        .then(ids => setSelectionResult({ requestId, ids }))
        .catch(queryError => showToast(getErrorMessage(queryError)));
    } else if (selectedIds?.length && onSelectionAction) {
      void onSelectionAction(action, selectedIds, chapterId).catch(
        actionError => showToast(getErrorMessage(actionError)),
      );
    } else {
      onAction(action);
    }
  };

  return (
    <>
      <NativeChapterList
        ref={listRef}
        storeId={storeId}
        theme={theme}
        rowFormat={rowFormat}
        novelDetails={{
          ...details,
          chapterSettings: chapterControls.chapterSettings,
          chapterJump: chapterControls.chapterJump,
          chapterControlScope: chapterSetKey,
        }}
        jumpResult={chapterControls.jumpResult}
        onNovelAction={handleNovelAction}
        selectionResult={selectionResult}
        isLocal={novel.isLocal ?? false}
        refreshing={updating}
        refreshOffset={topInset + 32}
        contentPaddingBottom={100 + bottomInset}
        fastScrollTopInset={topInset + 56}
        fastScrollBottomInset={bottomInset + 16}
        batchSize={CHAPTER_BATCH_SIZE}
        onRefresh={onRefresh}
        onChapterPress={withChapter(navigateToChapter)}
        onDownloadPress={withChapter(handleDownloadChapter)}
        onDeletePress={withChapter(handleDeleteChapter)}
        onRequestRange={onRequestRange}
      />
      {hasNovel ? (
        <>
          {trackerSheetMounted ? (
            <TrackSheet bottomSheetRef={trackerSheetRef} novel={novel} />
          ) : null}
          {pageNavigationSheetMounted ? (
            <PageNavigationBottomSheet
              bottomSheetRef={pageNavigationSheetRef}
              theme={theme}
              pages={pages}
              pageIndex={pageIndex}
              openPage={openPage}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default React.memo(NovelScreenList);
