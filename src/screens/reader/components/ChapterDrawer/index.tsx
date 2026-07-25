import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { Button, LoadingScreenV2 } from '@components/index';
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
import { noop } from 'lodash-es';
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

const ChapterDrawer = () => {
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
  // ChapterInfo is used via the hooks

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

  const calculateScrollToIndex = useCallback(() => {
    if (chapters.length < 1) {
      return;
    }

    const indexOfCurrentChapter =
      chapters.findIndex(el => {
        return el.id === chapter.id;
      }) || 0;

    return indexOfCurrentChapter >= 2 ? indexOfCurrentChapter - 2 : 0;
  }, [chapters, chapter.id]);

  /**
   * Index the list should sit at, or `undefined` while the chapters are still
   * loading. Derived during render (rather than read back from the ref) so the
   * list actually appears once the chapters arrive.
   */
  const currentScrollIndex = calculateScrollToIndex();
  const scrollToIndex = useRef<number | undefined>(currentScrollIndex);

  const [footerBtnProps, setButtonProperties] =
    useState<ButtonsProperties>(defaultButtonLayout);

  const checkViewableItems = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const curChapter = getString(
        'readerScreen.drawer.scrollToCurrentChapter',
      );
      const newBtnLayout = Object.create(defaultButtonLayout);

      if (viewableItems.length === 0) return;
      const visible = viewableItems
        .map(v => v.index)
        .includes((scrollToIndex.current ?? 0) + 2);

      if (!visible && scrollToIndex.current !== undefined) {
        if (
          listAscending
            ? (viewableItems[0].index ?? 0) < scrollToIndex.current + 2
            : (viewableItems[0].index ?? 0) > scrollToIndex.current + 2
        ) {
          newBtnLayout.down = {
            text: curChapter,
            index: scrollToIndex.current,
          };
        } else {
          newBtnLayout.up = {
            text: curChapter,
            index: scrollToIndex.current,
          };
        }
      }

      setButtonProperties(newBtnLayout);
    },
    [defaultButtonLayout, listAscending],
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
      <Text style={styles.headerCtn}>{getString('common.chapters')}</Text>
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
          estimatedItemSize={60}
          initialScrollIndex={currentScrollIndex}
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
      marginBottom: 12,
      marginHorizontal: 16,
      marginTop: 4,
    },
    chapterCtn: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    chapterNameCtn: {
      color: theme.onSurface,
      fontSize: 12,
      marginBottom: 2,
    },
    drawer: {
      backgroundColor: theme.surface,
      flex: 1,
      paddingTop: 48,
    },
    drawerElementContainer: {
      borderRadius: 50,
      margin: 4,
      marginHorizontal: 16,
      minHeight: 48,
      overflow: 'hidden',
    },
    footer: {
      borderTopColor: theme.outline,
      borderTopWidth: 1,
      marginTop: 4,
      paddingBottom: insets.bottom,
      paddingTop: 8,
    },
    headerCtn: {
      borderBottomColor: theme.outline,
      borderBottomWidth: 1,
      color: theme.onSurface,
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 4,
      padding: 16,
    },
    releaseDateCtn: {
      color: theme.onSurfaceVariant,
      fontSize: 10,
    },
  });
};

export default ChapterDrawer;
