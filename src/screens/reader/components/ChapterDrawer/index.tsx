import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { Button, LoadingScreenV2 } from '@components/index';
import IconButtonV2 from '@components/IconButtonV2/IconButtonV2';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import RenderListChapter from './RenderListChapter';
import { useChapterContext } from '@screens/reader/ChapterContext';
import {
  LegendList,
  LegendListRef,
  ViewToken,
} from '@legendapp/list/react-native';
import noop from 'lodash-es/noop';
import { useNovelActions, useNovelValue } from '@screens/novel/NovelContext';
import { ChapterInfo } from '@database/types';

type ButtonProperties = {
  text: string;
  index?: number;
};

type ButtonsProperties = {
  up: ButtonProperties;
  down: ButtonProperties;
};

const viewabilityConfig = {
  minimumViewTime: 100,
  itemVisiblePercentThreshold: 90,
};

type ChapterDrawerProps = {
  onClose?: () => void;
};

const ChapterDrawer = ({ onClose }: ChapterDrawerProps) => {
  const { chapter, getChapter, setLoading } = useChapterContext();
  const chapters = useNovelValue('chapters');
  const novelSettings = useNovelValue('novelSettings');
  const pages = useNovelValue('pages');
  const fetching = useNovelValue('fetching');
  const batchInformation = useNovelValue('batchInformation');
  const { getNextChapterBatch, openPage } = useNovelActions();

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { defaultChapterSort } = useAppSettings();
  const listRef = useRef<LegendListRef | null>(null);

  const styles = useMemo(
    () => createStylesheet(theme, insets),
    [theme, insets],
  );

  const { sort = defaultChapterSort } = novelSettings;
  const listAscending = sort.endsWith('Asc');

  const defaultButtonLayout: ButtonsProperties = useMemo(
    () => ({
      up: {
        text: getString('readerScreen.drawer.scrollToTop'),
        index: 0,
      },
      down: {
        text: getString('readerScreen.drawer.scrollToBottom'),
        index: undefined,
      },
    }),
    [],
  );

  useEffect(() => {
    let pageIndex = pages.indexOf(chapter.page ?? '');
    if (pageIndex === -1) {
      pageIndex = 0;
    }
    openPage(pageIndex);
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
   * Index the list should sit at, or `undefined` while the chapters are still
   * loading. Derived during render (rather than read back from the ref) so the
   * list actually appears once the chapters arrive.
   */
  const scrollToIndex = useRef<number | undefined>(currentScrollIndex);

  const [footerBtnProps, setButtonProperties] =
    useState<ButtonsProperties>(defaultButtonLayout);

  const checkViewableItems = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0 || currentChapterIndex === undefined) {
        return;
      }

      const newBtnLayout: ButtonsProperties = {
        up: { ...defaultButtonLayout.up },
        down: { ...defaultButtonLayout.down },
      };
      const currentChapterVisible = viewableItems
        .map(item => item.index)
        .includes(currentChapterIndex);

      if (!currentChapterVisible && currentScrollIndex !== undefined) {
        const firstVisibleIndex = viewableItems[0].index ?? 0;
        const currentChapterButton = {
          text: getString('readerScreen.drawer.scrollToCurrentChapter'),
          index: currentScrollIndex,
        };

        if (
          listAscending
            ? firstVisibleIndex < currentChapterIndex
            : firstVisibleIndex > currentChapterIndex
        ) {
          newBtnLayout.down = currentChapterButton;
        } else {
          newBtnLayout.up = currentChapterButton;
        }
      }

      setButtonProperties(newBtnLayout);
    },
    [
      currentChapterIndex,
      currentScrollIndex,
      defaultButtonLayout,
      listAscending,
    ],
  );

  const openChapter = useCallback(
    (item: ChapterInfo) => {
      setLoading(true);
      getChapter(item);
    },
    [getChapter, setLoading],
  );

  // Every prop here is stable for a given chapter, so unchanged rows can skip
  // re-rendering when the chapter list is rebuilt.
  const renderItem = useCallback(
    ({ item }: { item: ChapterInfo }) => (
      <RenderListChapter
        item={item}
        styles={styles}
        theme={theme}
        chapterId={chapter.id}
        onPress={openChapter}
      />
    ),
    [chapter.id, openChapter, styles, theme],
  );

  const scroll = useCallback((index?: number) => {
    if (index !== undefined) {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
      });
    } else {
      listRef.current?.scrollToEnd({
        animated: true,
      });
    }
  }, []);

  useEffect(() => {
    if (currentScrollIndex !== undefined) {
      if (
        scrollToIndex.current === undefined ||
        currentScrollIndex !== scrollToIndex.current
      ) {
        scroll(currentScrollIndex);
      }
      scrollToIndex.current = currentScrollIndex;
    }
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
        <LegendList
          ref={listRef}
          recycleItems
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={checkViewableItems}
          data={chapters}
          extraData={chapter.id}
          keyExtractor={item =>
            `chapter_${item.id}_${item.position ?? 'no_pos'}`
          }
          renderItem={renderItem}
          estimatedItemSize={62}
          initialScrollIndex={currentScrollIndex}
          contentContainerStyle={styles.listContent}
          onEndReached={
            batchInformation.batch < batchInformation.total && !fetching
              ? getNextChapterBatch
              : noop
          }
          onEndReachedThreshold={6}
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
    chapterCtn: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    chapterNameCtn: {
      color: theme.onSurface,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 2,
    },
    drawer: {
      backgroundColor: theme.surface,
      flex: 1,
      paddingTop: insets.top,
    },
    drawerElementContainer: {
      marginVertical: 2,
      minHeight: 48,
      overflow: 'hidden',
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
    listContent: {
      paddingBottom: 8,
      paddingTop: 12,
    },
    releaseDateCtn: {
      color: theme.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 16,
    },
  });
};

export default ChapterDrawer;
