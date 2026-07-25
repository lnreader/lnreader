import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';

import ReaderAppbar from './components/ReaderAppbar';
import ReaderFooter from './components/ReaderFooter';

import WebViewReader from './components/WebViewReader';
import ReaderBottomSheetV2 from './components/ReaderBottomSheet/ReaderBottomSheet';
import ChapterDrawer from './components/ChapterDrawer';
import ChapterLoadingScreen from './ChapterLoadingScreen/ChapterLoadingScreen';
import { ErrorScreenV2 } from '@components';
import { ChapterScreenProps } from '@navigators/types';
import { getString } from '@i18n/translations';
import KeepScreenAwake from './components/KeepScreenAwake';
import { ChapterContextProvider, useChapterContext } from './ChapterContext';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useBackHandler } from '@hooks/index';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { EMPTY_READER_SEARCH_RESULT, ReaderSearchResult } from './types';

const Chapter = ({ route, navigation }: ChapterScreenProps) => {
  const [open, setOpen] = useState(false);
  /**
   * The drawer renders a list of every chapter in the novel and is mounted
   * off-screen by `Drawer`. Mounting it up front competes with the chapter load
   * for the JS thread, so it is only created once the drawer is actually used.
   */
  const [drawerMounted, setDrawerMounted] = useState(false);

  useBackHandler(() => {
    if (open) {
      setOpen(false);
      return true;
    }
    return false;
  });

  const openDrawer = useCallback(() => {
    setDrawerMounted(true);
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setOpen(false), []);

  const renderDrawerContent = useCallback(
    () => (drawerMounted ? <ChapterDrawer /> : null),
    [drawerMounted],
  );

  return (
    <ChapterContextProvider
      novel={route.params.novel}
      initialChapter={route.params.chapter}
    >
      <Drawer
        open={open}
        onOpen={openDrawer}
        onClose={closeDrawer}
        renderDrawerContent={renderDrawerContent}
      >
        <ChapterContent
          route={route}
          navigation={navigation}
          openDrawer={openDrawer}
        />
      </Drawer>
    </ChapterContextProvider>
  );
};

type ChapterContentProps = ChapterScreenProps & {
  openDrawer: () => void;
};

export const ChapterContent = ({
  navigation,
  openDrawer,
}: ChapterContentProps) => {
  const { left, right } = useSafeAreaInsets();
  const {
    novel,
    chapter,
    onUserInteraction,
    hidden,
    loading,
    error,
    webViewRef,
    hideHeader,
    refetch,
  } = useChapterContext();
  const readerSheetRef = useRef<BottomSheetModalMethods>(null);
  const theme = useTheme();
  const { pageReader = false, keepScreenOn } = useChapterGeneralSettings();
  const [bookmarked, setBookmarked] = useState<boolean>(
    chapter.bookmark ?? false,
  );
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchResult, setSearchResult] = useState<ReaderSearchResult>(
    EMPTY_READER_SEARCH_RESULT,
  );
  const [searchText, setSearchTextState] = useState('');
  const searchTextRef = useRef('');
  /**
   * The settings sheet mounts a tab view (including the TTS engine/voice
   * pickers), which is far too much work to do while the chapter is loading.
   */
  const [readerSheetMounted, setReaderSheetMounted] = useState(false);
  const pendingSheetPresentRef = useRef(false);

  const setSearchText = useCallback((text: string) => {
    searchTextRef.current = text;
    setSearchTextState(text);
  }, []);

  const resetSearchResult = useCallback(() => {
    setSearchResult(EMPTY_READER_SEARCH_RESULT);
  }, []);

  const resetSearch = useCallback(() => {
    setSearchText('');
    resetSearchResult();
  }, [resetSearchResult, setSearchText]);

  const openReaderSheet = useCallback(() => {
    if (readerSheetMounted) {
      readerSheetRef.current?.present();
      return;
    }
    pendingSheetPresentRef.current = true;
    setReaderSheetMounted(true);
  }, [readerSheetMounted]);

  useEffect(() => {
    if (readerSheetMounted && pendingSheetPresentRef.current) {
      pendingSheetPresentRef.current = false;
      readerSheetRef.current?.present();
    }
  }, [readerSheetMounted]);

  useBackHandler(
    useCallback(() => {
      if (searchVisible) {
        setSearchVisible(false);
        return true;
      }

      return false;
    }, [searchVisible]),
  );

  useEffect(() => {
    setBookmarked(chapter.bookmark ?? false);
  }, [chapter]);

  useEffect(() => {
    setSearchVisible(false);
    resetSearch();
  }, [chapter.id, resetSearch]);

  useEffect(() => {
    if (hidden) {
      setSearchVisible(false);
    }
  }, [hidden]);

  useEffect(() => {
    if (hidden) {
      return;
    }

    webViewRef.current?.injectJavaScript(`
      if (window.reader?.hidden) {
        window.reader.hidden.val = ${searchVisible ? 'true' : 'false'};
      }
      true;
    `);
  }, [hidden, searchVisible, webViewRef]);

  const scrollToStart = useCallback(() => {
    onUserInteraction();
    requestAnimationFrame(() => {
      webViewRef?.current?.injectJavaScript(
        !pageReader
          ? `(()=>{
                window.scrollTo({top:0,behavior:'smooth'})
              })()`
          : `(()=>{
              document.querySelector('chapter').setAttribute('data-page',0);
              document.querySelector("chapter").style.transform = 'translate(0%)';
            })()`,
      );
    });
  }, [onUserInteraction, pageReader, webViewRef]);

  const openDrawerI = useCallback(() => {
    openDrawer();
    hideHeader();
  }, [hideHeader, openDrawer]);

  const handleReaderTouchStart = useCallback(() => {
    if (searchVisible) {
      Keyboard.dismiss();
    }
  }, [searchVisible]);

  const handleReaderPress = useCallback(() => {
    onUserInteraction();
    if (searchVisible) {
      setSearchVisible(false);
      return;
    }
    hideHeader();
  }, [hideHeader, onUserInteraction, searchVisible]);

  if (error) {
    return (
      <ErrorScreenV2
        error={error}
        actions={[
          {
            iconName: 'refresh',
            title: getString('common.retry'),
            onPress: refetch,
          },
          {
            iconName: 'earth',
            title: 'WebView',
            onPress: () =>
              navigation.navigate('WebviewScreen', {
                name: novel.name,
                url: chapter.path,
                pluginId: novel.pluginId,
              }),
          },
        ]}
      />
    );
  }
  return (
    <View style={[{ paddingStart: left, paddingEnd: right }, styles.container]}>
      {keepScreenOn ? <KeepScreenAwake /> : null}
      {loading ? (
        <ChapterLoadingScreen />
      ) : (
        <WebViewReader
          onPress={handleReaderPress}
          onTouchStart={handleReaderTouchStart}
          onSearchResult={setSearchResult}
          searchTextRef={searchTextRef}
        />
      )}
      {readerSheetMounted ? (
        <ReaderBottomSheetV2 bottomSheetRef={readerSheetRef} />
      ) : null}
      {!hidden ? (
        <>
          <ReaderAppbar
            goBack={navigation.goBack}
            theme={theme}
            bookmarked={bookmarked}
            setBookmarked={setBookmarked}
            searchVisible={searchVisible}
            setSearchVisible={setSearchVisible}
            searchText={searchText}
            setSearchText={setSearchText}
            searchResult={searchResult}
            resetSearchResult={resetSearchResult}
            resetSearch={resetSearch}
          />
          {!searchVisible ? (
            <ReaderFooter
              openReaderSheet={openReaderSheet}
              scrollToStart={scrollToStart}
              navigation={navigation}
              openDrawer={openDrawerI}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
};

export default Chapter;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
