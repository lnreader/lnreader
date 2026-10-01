import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { Button, LoadingScreenV2 } from '@components/index';
import IconButtonV2 from '@components/IconButtonV2/IconButtonV2';
import AppHost from '@components/AppHost/AppHost';
import AppText from '@components/AppText/AppText';
import {
  ComposeList,
  type ComposeListHandle,
} from '@components/ComposeList/ComposeList';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getString } from '@i18n/translations';
import RenderListChapter from './RenderListChapter';
import { useChapterContext } from '@screens/reader/ChapterContext';
import { ViewToken } from '@legendapp/list/react-native';
import noop from 'lodash-es/noop';
import { useNovelActions, useNovelValue } from '@screens/novel/NovelContext';
import { ChapterInfo } from '@database/types';
import CloseIcon from '@expo/material-symbols/close.xml';
import ManageSearchIcon from '@expo/material-symbols/manage_search.xml';
import MyLocationIcon from '@expo/material-symbols/my_location.xml';

type ButtonProperties = {
  text: string;
  index?: number;
  viewPosition?: number;
};

const CENTER = 0.5;

type ButtonsProperties = {
  up: ButtonProperties;
  down: ButtonProperties;
};

// 48dp icon buttons with 8dp above and below.
const HEADER_HEIGHT = 64;

// Two buttons of 48dp (with their touch target), 8dp apart, 8dp from the list.
const FOOTER_BUTTONS_HEIGHT = 112;

const viewabilityConfig = {
  minimumViewTime: 100,
  itemVisiblePercentThreshold: 90,
};

type ChapterDrawerProps = {
  onClose?: () => void;
  onFindChapter?: () => void;
  /** Shared with the find-chapter dialog, which scrolls the list. */
  listRef?: RefObject<ComposeListHandle | null>;
};

// Fixed heights: the header and footer sit in plain React Native layout
// around the list, and matchContents hosts there could measure zero.
const DrawerHost = ({
  children,
  height,
}: {
  children: ReactNode;
  height: number;
}) => <AppHost style={{ height }}>{children}</AppHost>;

const ChapterDrawer = ({
  onClose,
  onFindChapter,
  listRef: sharedListRef,
}: ChapterDrawerProps) => {
  const listRef = useRef<ComposeListHandle | null>(null);
  useImperativeHandle(sharedListRef, () => ({
    scrollToIndex: (index, options) =>
      listRef.current?.scrollToIndex(index, options),
    scrollToTop: () => listRef.current?.scrollToTop(),
    scrollToEnd: options => listRef.current?.scrollToEnd(options),
  }));
  const { chapter, openChapter: openReaderChapter } = useChapterContext();
  const chapters = useNovelValue('chapters');
  const novelSettings = useNovelValue('novelSettings');
  const pages = useNovelValue('pages');
  const fetching = useNovelValue('fetching');
  const batchInformation = useNovelValue('batchInformation');
  const { getNextChapterBatch, openPage } = useNovelActions();

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    defaultChapterSort,
    dateFormat = 'default',
    relativeTimestamps = true,
  } = useAppSettings();

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

  const currentScrollIndex = currentChapterIndex;

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
          viewPosition: CENTER,
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
      onClose?.();
      openReaderChapter(item);
    },
    [onClose, openReaderChapter],
  );

  // Every prop here is stable for a given chapter, so unchanged rows can skip
  // re-rendering when the chapter list is rebuilt.
  const renderItem = useCallback(
    (item: ChapterInfo) => (
      <RenderListChapter
        item={item}
        theme={theme}
        chapterId={chapter.id}
        onPress={openChapter}
        dateFormat={dateFormat}
        relativeTimestamps={relativeTimestamps}
      />
    ),
    [chapter.id, dateFormat, openChapter, relativeTimestamps, theme],
  );

  const scroll = useCallback((index?: number, viewPosition?: number) => {
    if (index !== undefined) {
      listRef.current?.scrollToIndex(index, {
        animated: true,
        viewPosition,
      });
    } else {
      listRef.current?.scrollToEnd({
        animated: true,
      });
    }
  }, []);

  useEffect(() => {
    if (currentScrollIndex === undefined) {
      return;
    }
    // An `undefined` previous index means the list was still loading and is
    // only mounting now, with `initialScrollIndex` already pointing at the
    // right row; animating to it would add a second, visible jump.
    if (
      scrollToIndex.current !== undefined &&
      currentScrollIndex !== scrollToIndex.current
    ) {
      scroll(currentScrollIndex, CENTER);
    }
    scrollToIndex.current = currentScrollIndex;
  }, [currentScrollIndex, scroll]);

  return (
    <View
      style={[
        styles.drawer,
        { backgroundColor: theme.surface, paddingTop: insets.top },
      ]}
    >
      <DrawerHost height={HEADER_HEIGHT}>
        <Row
          verticalAlignment="center"
          modifiers={[fillMaxWidth(), padding(16, 8, 4, 8)]}
        >
          <AppText
            variant="titleLarge"
            weight="600"
            color={theme.onSurface}
            modifiers={[weight(1)]}
          >
            {getString('common.chapters')}
          </AppText>
          {onFindChapter ? (
            <IconButtonV2
              accessibilityLabel={getString(
                'novelScreen.jumpToChapterModal.jumpToChapter',
              )}
              name={ManageSearchIcon}
              onPress={onFindChapter}
              theme={theme}
            />
          ) : null}
          <IconButtonV2
            accessibilityLabel={getString(
              'readerScreen.drawer.scrollToCurrentChapter',
            )}
            name={MyLocationIcon}
            disabled={currentScrollIndex === undefined}
            onPress={() => scroll(currentScrollIndex, CENTER)}
            theme={theme}
          />
          {onClose ? (
            <IconButtonV2
              accessibilityLabel={getString('common.close')}
              name={CloseIcon}
              onPress={onClose}
              theme={theme}
            />
          ) : null}
        </Row>
      </DrawerHost>
      {currentScrollIndex === undefined ? (
        <AppHost style={styles.drawer}>
          <LoadingScreenV2 theme={theme} />
        </AppHost>
      ) : (
        <ComposeList
          ref={listRef}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={checkViewableItems}
          data={chapters}
          extraData={chapter.id}
          keyExtractor={item =>
            `chapter_${item.id}_${item.position ?? 'no_pos'}`
          }
          renderItem={renderItem}
          estimatedItemSize={62}
          initialIndex={currentScrollIndex}
          initialViewPosition={CENTER}
          contentPadding={{ top: 12, bottom: 8 }}
          onEndReached={
            batchInformation.batch < batchInformation.total && !fetching
              ? getNextChapterBatch
              : noop
          }
          onEndReachedThreshold={6}
        />
      )}
      <DrawerHost height={FOOTER_BUTTONS_HEIGHT + Math.max(insets.bottom, 8)}>
        <Column
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[
            fillMaxWidth(),
            padding(16, 8, 16, Math.max(insets.bottom, 8)),
          ]}
        >
          <Button
            mode="contained"
            title={footerBtnProps.up.text}
            onPress={() =>
              scroll(footerBtnProps.up.index, footerBtnProps.up.viewPosition)
            }
            modifiers={[fillMaxWidth()]}
          />
          <Button
            mode="contained"
            title={footerBtnProps.down.text}
            onPress={() =>
              scroll(
                footerBtnProps.down.index,
                footerBtnProps.down.viewPosition,
              )
            }
            modifiers={[fillMaxWidth()]}
          />
        </Column>
      </DrawerHost>
    </View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
  },
});

export default ChapterDrawer;
