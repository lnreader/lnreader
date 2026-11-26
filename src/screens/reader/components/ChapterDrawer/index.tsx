import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { Button, LoadingScreenV2 } from '@components/index';
import IconButtonV2 from '@components/IconButtonV2/IconButtonV2';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import { useChapterContext } from '@screens/reader/ChapterContext';
import { useNovelActions, useNovelValue } from '@screens/novel/NovelContext';
import { ChapterInfo } from '@database/types';
import { getChapter as getChapterById } from '@database/queries/ChapterQueries';
import {
  buildChapterRowFormat,
  type HighlightedVisibility,
  NativeChapterList,
  type NativeChapterListRef,
  useChapterBatchRequests,
  useChapterListStore,
} from '@components/NativeChapterList';
import { CHAPTER_BATCH_SIZE } from '@hooks/persisted/useNovel/types';

type ButtonProperties = {
  text: string;
  index?: number;
};

type ButtonsProperties = {
  up: ButtonProperties;
  down: ButtonProperties;
};

type ChapterDrawerProps = {
  onClose?: () => void;
};

const NO_IDS = new Set<number>();
const LIST_PADDING_TOP = 12;
const LIST_PADDING_BOTTOM = 8;
const FAST_SCROLL_INSET = 8;

const ChapterDrawer = ({ onClose }: ChapterDrawerProps) => {
  const { chapter, getChapter, setLoading } = useChapterContext();
  const chapters = useNovelValue('chapters');
  const novel = useNovelValue('novel');
  const novelSettings = useNovelValue('novelSettings');
  const pages = useNovelValue('pages');
  const pageIndex = useNovelValue('pageIndex');
  const fetching = useNovelValue('fetching');
  const batchInformation = useNovelValue('batchInformation');
  const { loadUpToBatch, openPage } = useNovelActions();

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    defaultChapterSort,
    reduceAppAnimations = false,
    dateFormat = 'default',
    relativeTimestamps = true,
  } = useAppSettings();
  const listRef = useRef<NativeChapterListRef | null>(null);

  const styles = useMemo(
    () => createStylesheet(theme, insets),
    [theme, insets],
  );

  const { sort = defaultChapterSort } = novelSettings;
  const listAscending = sort.endsWith('Asc');

  useEffect(() => {
    const chapterPageIndex = pages.indexOf(chapter.page ?? '');
    openPage(chapterPageIndex === -1 ? 0 : chapterPageIndex);
    // Only the page matters here; depending on the whole chapter object would
    // re-run this on every progress update.
  }, [chapter.page, pages, openPage]);

  const currentChapterIndex = useMemo(() => {
    if (chapters.length < 1) {
      return;
    }

    const index = chapters.findIndex(el => el.id === chapter.id);
    return index >= 0 ? index : 0;
  }, [chapter.id, chapters]);

  const currentScrollIndex =
    currentChapterIndex === undefined
      ? undefined
      : Math.max(0, currentChapterIndex - 2);

  /**
   * Index the list last sat at, or `undefined` while the chapters were still
   * loading; the list then mounts at `initialPosition` instead of scrolling.
   */
  const scrollToIndex = useRef<number | undefined>(currentScrollIndex);

  // --- Native list data ---

  // Page, sort, filter and scanlator changes replace the chapter list.
  const chapterSetKey = useMemo(
    () => JSON.stringify([novel?.id, pageIndex, novelSettings]),
    [novel?.id, pageIndex, novelSettings],
  );
  const totalChapters = Math.max(
    batchInformation.totalChapters ?? 0,
    chapters.length,
  );

  const requestUpTo = useChapterBatchRequests({
    chapterSetKey,
    fetching,
    loadedBatch: batchInformation.batch,
    loadUpToBatch,
  });

  // Reading progress is written continuously and re-creates `chapters`; the
  // store diff turns that into `updateRows` for the changed rows only.
  const storeId = useChapterListStore({
    chapters,
    totalChapters,
    dataKey: chapterSetKey,
    selectedIds: NO_IDS,
    downloadingIds: NO_IDS,
    highlightedId: chapter.id,
    onStaleRows: (_start, end) => requestUpTo(end - 1),
  });

  const onRequestRange = useCallback(
    (_start: number, end: number) => requestUpTo(end),
    [requestUpTo],
  );

  const rowFormat = useMemo(
    () =>
      buildChapterRowFormat({
        showChapterTitles: true,
        dateFormat,
        relativeTimestamps,
      }),
    [dateFormat, relativeTimestamps],
  );

  // --- Footer buttons ---

  const [highlightedVisibility, setHighlightedVisibility] =
    useState<HighlightedVisibility>('visible');

  const footerBtnProps = useMemo<ButtonsProperties>(() => {
    const buttons: ButtonsProperties = {
      up: {
        text: getString('readerScreen.drawer.scrollToTop'),
        index: 0,
      },
      down: {
        text: getString('readerScreen.drawer.scrollToBottom'),
        index: undefined,
      },
    };
    if (
      highlightedVisibility !== 'visible' &&
      currentScrollIndex !== undefined
    ) {
      const currentChapterButton = {
        text: getString('readerScreen.drawer.scrollToCurrentChapter'),
        index: currentScrollIndex,
      };
      const below = highlightedVisibility === 'below';
      if (listAscending ? below : !below) {
        buttons.down = currentChapterButton;
      } else {
        buttons.up = currentChapterButton;
      }
    }
    return buttons;
  }, [currentScrollIndex, highlightedVisibility, listAscending]);

  // --- Press ---

  const openChapter = useCallback(
    (item: ChapterInfo) => {
      setLoading(true);
      getChapter(item);
    },
    [getChapter, setLoading],
  );

  // Native rows carry their position, and loaded chapters are the start of
  // the list, so a row is almost always chapters[position]. Rows native kept
  // from before a reload may not be loaded in JS yet; read those from the DB.
  const onChapterPress = useCallback(
    (id: number, position: number) => {
      const item =
        chapters[position]?.id === id
          ? chapters[position]
          : chapters.find(el => el.id === id);
      if (item) {
        openChapter(item);
        return;
      }
      void getChapterById(id).then(row => {
        if (row) {
          openChapter(row as ChapterInfo);
        }
      });
    },
    [chapters, openChapter],
  );

  const scroll = useCallback(
    (index?: number) => {
      if (index !== undefined) {
        listRef.current?.scrollToIndex({
          index,
          animated: !reduceAppAnimations,
        });
      } else {
        listRef.current?.scrollToEnd({
          animated: !reduceAppAnimations,
        });
      }
    },
    [reduceAppAnimations],
  );

  useEffect(() => {
    if (currentScrollIndex === undefined) {
      return;
    }
    // An `undefined` previous index means the list was still loading and is
    // only mounting now, with `initialPosition` already pointing at the right
    // row; animating to it would add a second, visible jump.
    if (
      scrollToIndex.current !== undefined &&
      currentScrollIndex !== scrollToIndex.current
    ) {
      scroll(currentScrollIndex);
    }
    scrollToIndex.current = currentScrollIndex;
  }, [currentScrollIndex, scroll]);

  return (
    <View style={styles.drawer}>
      <View style={styles.headerCtn}>
        <Text style={styles.headerTitle}>{getString('common.chapters')}</Text>
        {onClose ? (
          <IconButtonV2
            accessibilityLabel={getString('common.close')}
            name="close"
            onPress={onClose}
            padding={12}
            theme={theme}
          />
        ) : null}
      </View>
      {currentScrollIndex === undefined ? (
        <LoadingScreenV2 theme={theme} />
      ) : (
        <NativeChapterList
          ref={listRef}
          variant="drawer"
          storeId={storeId}
          theme={theme}
          rowFormat={rowFormat}
          initialPosition={currentScrollIndex}
          contentPaddingTop={LIST_PADDING_TOP}
          contentPaddingBottom={LIST_PADDING_BOTTOM}
          fastScrollTopInset={FAST_SCROLL_INSET}
          fastScrollBottomInset={FAST_SCROLL_INSET}
          batchSize={CHAPTER_BATCH_SIZE}
          onChapterPress={onChapterPress}
          onRequestRange={onRequestRange}
          onHighlightedVisibilityChange={setHighlightedVisibility}
        />
      )}
      <View style={styles.footer}>
        <Button
          mode="contained"
          style={styles.button}
          title={footerBtnProps.up.text}
          onPress={() => scroll(footerBtnProps.up.index)}
        />
        <Button
          mode="contained"
          style={styles.button}
          title={footerBtnProps.down.text}
          onPress={() => scroll(footerBtnProps.down.index)}
        />
      </View>
    </View>
  );
};

const createStylesheet = (theme: ThemeColors, insets: EdgeInsets) => {
  return StyleSheet.create({
    button: {
      marginVertical: 4,
    },
    drawer: {
      backgroundColor: theme.surface,
      flex: 1,
      paddingTop: insets.top,
    },
    footer: {
      borderTopColor: theme.outlineVariant,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingBottom: Math.max(insets.bottom, 8),
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    headerCtn: {
      alignItems: 'center',
      borderBottomColor: theme.outlineVariant,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 64,
      paddingLeft: 16,
      paddingRight: 4,
      paddingVertical: 8,
    },
    headerTitle: {
      color: theme.onSurface,
      flex: 1,
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
    },
  });
};

export default ChapterDrawer;
