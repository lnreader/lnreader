import * as React from 'react';
import ChapterItem from './ChapterItem';
import NovelInfoHeader from './Info/NovelInfoHeader';
import { useRef, useState } from 'react';
import { pickCustomNovelCover } from '@database/queries/NovelQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import { useBoolean } from '@hooks/index';
import { useAppSettings, useDownload, useTheme } from '@hooks/persisted';
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
import { useNovelContext } from '../NovelContext';
import { LegendList, LegendListRef } from '@legendapp/list';
import FileManager from '@specs/NativeFile';
import { downloadFile } from '@plugins/helpers/fetch';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import PagePaginationControl from './PagePaginationControl';

type NovelScreenListProps = {
  headerOpacity: SharedValue<number>;
  listRef: React.RefObject<LegendListRef | null>;
  navigation: any;
  selected: ChapterInfo[];
  setSelected: React.Dispatch<React.SetStateAction<ChapterInfo[]>>;
  getNextChapterBatch: () => void;
  routeBaseNovel: {
    name: string;
    path: string;
    pluginId: string;
    cover?: string;
  };
};

const ListEmptyComponent = () => <ChapterListSkeleton />;

const NovelScreenList = ({
  headerOpacity,
  listRef,
  navigation,
  routeBaseNovel,
  selected,
  setSelected,
  getNextChapterBatch,
}: NovelScreenListProps) => {
  const {
    chapters,
    deleteChapter,
    fetching,
    getNovel,
    lastRead,
    loading,
    novelSettings,
    pages,
    setNovel,
    sortAndFilterChapters,
    setShowChapterTitles,
    updateChapter,
    novel: fetchedNovel,
    batchInformation,
    pageIndex,
    openPage,
  } = useNovelContext();

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
    defaultChapterSort,
    disableHapticFeedback,
    downloadNewChapters,
    refreshNovelMetadata,
  } = useAppSettings();

  const {
    sort = defaultChapterSort,
    filter = '',
    showChapterTitles = false,
  } = novelSettings;

  const theme = useTheme();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const { downloadQueue, downloadChapter } = useDownload();

  const [isFabExtended, setIsFabExtended] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const novelBottomSheetRef = useRef<BottomSheetModalMethods>(null);
  const trackerSheetRef = useRef<BottomSheetModalMethods>(null);
  const pageNavigationSheetRef = useRef<BottomSheetModalMethods>(null);

  const deleteDownloadsSnackbar = useBoolean();

  const onPageScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;

    headerOpacity.set(y < 50 ? 0 : (y - 50) / 150);
    const currentScrollPosition = Math.floor(y) ?? 0;
    if (useFabForContinueReading && lastRead) {
      setIsFabExtended(currentScrollPosition <= 0);
    }

    const screenHeight = Dimensions.get('window').height;
    setShowScrollToTop(currentScrollPosition > screenHeight / 2);
  };

  const onRefresh = async () => {
    if (novel.id !== 'NO_ID') {
      setUpdating(true);
      updateNovel(pluginId, novel.path, novel.id, {
        downloadNewChapters,
        refreshNovelMetadata,
      })
        .then(() => getNovel())
        .then(() =>
          showToast(
            getString('novelScreen.updatedToast', { name: novel.name }),
          ),
        )
        .catch(error => showToast('Failed updating: ' + error.message))
        .finally(() => setUpdating(false));
    }
  };

  const onRefreshPage = async (page: string) => {
    if (novel.id !== 'NO_ID') {
      setUpdating(true);
      updateNovelPage(pluginId, novel.path, novel.name, novel.id, page, {
        downloadNewChapters,
      })
        .then(() => getNovel())
        .then(() => showToast(`Updated page: ${page}`))
        .catch(e => showToast('Failed updating: ' + e.message))
        .finally(() => setUpdating(false));
    }
  };

  const refreshControl = () => (
    <RefreshControl
      progressViewOffset={topInset + 32}
      onRefresh={onRefresh}
      refreshing={updating}
      colors={[theme.primary]}
      progressBackgroundColor={theme.onPrimary}
    />
  );

  const isSelected = (id: number) => {
    return selected.some(obj => obj.id === id);
  };

  const onSelectPress = (chapter: ChapterInfo) => {
    if (selected.length === 0) {
      navigateToChapter(chapter);
    } else {
      if (isSelected(chapter.id)) {
        setSelected(sel => sel.filter(it => it.id !== chapter.id));
      } else {
        setSelected(sel => [...sel, chapter]);
      }
    }
  };

  const onSelectLongPress = (chapter: ChapterInfo) => {
    if (selected.length === 0) {
      if (!disableHapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setSelected(sel => [...sel, chapter]);
    } else {
      if (selected.length === chapters.length) {
        return;
      }

      /**
       * Select custom range
       */
      const lastSelectedChapter = selected[selected.length - 1];

      if (lastSelectedChapter.id !== chapter.id) {
        if (lastSelectedChapter.id > chapter.id) {
          setSelected(sel => [
            ...sel,
            chapter,
            ...chapters.filter(
              (chap: ChapterInfo) =>
                (chap.id <= chapter.id || chap.id >= lastSelectedChapter.id) ===
                false,
            ),
          ]);
        } else {
          setSelected(sel => [
            ...sel,
            chapter,
            ...chapters.filter(
              (chap: ChapterInfo) =>
                (chap.id >= chapter.id || chap.id <= lastSelectedChapter.id) ===
                false,
            ),
          ]);
        }
      }
    }
  };

  const navigateToChapter = (chapter: ChapterInfo) => {
    navigation.navigate('ReaderStack', {
      screen: 'Chapter',
      params: { novel, chapter },
    });
  };

  const scrollToTop = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const setCustomNovelCover = async () => {
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
  };

  const saveNovelCover = async () => {
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

      // sanitize novel name as app crashes while copying file with ':' character
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
  };

  const hasMultiplePages = pages.length > 1 || (novel?.totalPages ?? 0) > 1;

  return (
    <>
      <LegendList
        ref={listRef}
        estimatedItemSize={64}
        data={chapters}
        recycleItems
        extraData={[
          chapters.length,
          selected.length,
          novel.id,
          loading,
          downloadQueue.length,
        ]}
        // ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={
          !fetching ? (
            hasMultiplePages ? (
              <View>
                <PagePaginationControl
                  pages={pages}
                  currentPageIndex={pageIndex}
                  onPageChange={openPage}
                  onOpenDrawer={() => pageNavigationSheetRef.current?.present()}
                  theme={theme}
                />
              </View>
            ) : undefined
          ) : (
            ListEmptyComponent
          )
        }
        renderItem={({ item, index }) => {
          if (novel.id === 'NO_ID') {
            return null;
          }
          return (
            <ChapterItem
              isDownloading={downloadQueue.some(
                c => c.task.data.chapterId === item.id,
              )}
              isBookmarked={!!item.bookmark}
              isLocal={novel.isLocal}
              theme={theme}
              chapter={item}
              showChapterTitles={showChapterTitles}
              deleteChapter={() => deleteChapter(item)}
              downloadChapter={() => downloadChapter(novel, item)}
              isSelected={isSelected(item.id)}
              onSelectPress={onSelectPress}
              onSelectLongPress={onSelectLongPress}
              navigateToChapter={navigateToChapter}
              novelName={novel.name}
              setChapterDownloaded={(value: boolean) =>
                updateChapter?.(index, { isDownloaded: value })
              }
            />
          );
        }}
        keyExtractor={item => 'c' + item.id}
        contentContainerStyle={styles.contentContainer}
        refreshControl={refreshControl()}
        onEndReached={getNextChapterBatch}
        onEndReachedThreshold={6}
        onScroll={onPageScroll}
        drawDistance={1000}
        ListHeaderComponent={
          <NovelInfoHeader
            chapters={chapters}
            deleteDownloadsSnackbar={deleteDownloadsSnackbar}
            fetching={fetching}
            filter={filter}
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
        }
      />
      {novel.id !== 'NO_ID' && (
        <>
          <NovelBottomSheet
            bottomSheetRef={novelBottomSheetRef}
            sortAndFilterChapters={sortAndFilterChapters}
            setShowChapterTitles={setShowChapterTitles}
            sort={sort}
            theme={theme}
            filter={filter}
            showChapterTitles={showChapterTitles}
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
          {showScrollToTop && (
            <AnimatedFAB
              style={[
                styles.scrollToTopFab,
                { backgroundColor: theme.surface2, marginBottom: bottomInset },
              ]}
              color={theme.primary}
              icon="arrow-up"
              label=""
              extended={false}
              onPress={scrollToTop}
              visible={showScrollToTop}
            />
          )}
          {useFabForContinueReading && (lastRead || chapters[0]) ? (
            <AnimatedFAB
              style={[
                styles.fab,
                { backgroundColor: theme.primary, marginBottom: bottomInset },
              ]}
              extended={isFabExtended && !loading}
              color={theme.onPrimary}
              uppercase={false}
              label={
                lastRead
                  ? getString('common.resume')
                  : getString('novelScreen.startReadingChapters', {
                      name: '',
                    }).trim()
              }
              icon="play"
              onPress={() => {
                navigation.navigate('ReaderStack', {
                  screen: 'Chapter',
                  params: {
                    novel: novel,
                    chapter: lastRead ?? chapters[0],
                  },
                });
              }}
            />
          ) : null}
        </>
      )}
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
