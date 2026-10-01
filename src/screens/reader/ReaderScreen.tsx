import { useCallback, useEffect, useRef, useState } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxSize } from '@expo/ui/jetpack-compose/modifiers';
import { InteractionManager, Share, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';

import {
  useChapterGeneralSettings,
  useChapterReaderSettings,
} from '@hooks/persisted';
import { useBackHandler } from '@hooks/index';
import { getString } from '@i18n/translations';
import type { ChapterScreenProps } from '@navigators/types';
import { resolveUrl } from '@services/plugin/fetch';
import { showToast } from '@utils/showToast';
import KeepScreenAwake from './components/KeepScreenAwake';
import ChapterDrawer from './components/ChapterDrawer';
import JumpToChapterModal from '@screens/novel/components/JumpToChapterModal';
import ChapterLoadingScreen from './ChapterLoadingScreen/ChapterLoadingScreen';
import ReaderAppbar, { BAR_HEIGHT } from './components/ReaderAppbar';
import ReaderFooter, {
  ReaderSideSeekbar,
  bottomBarHeight,
} from './components/ReaderFooter';
import ReaderTtsController from './components/ReaderTtsController';
import ReaderBottomSheet from './components/ReaderBottomSheet/ReaderBottomSheet';
import ReaderSidePanel from './components/ReaderSidePanel';
import WebViewReader, {
  type ReaderTextAction,
} from './components/WebViewReader';
import {
  ChapterContextProvider,
  useChapterContext,
  useReaderChromeHidden,
} from './ChapterContext';
import PublicIcon from '@expo/material-symbols/public.xml';
import RefreshIcon from '@expo/material-symbols/refresh.xml';
import {
  AppHost,
  ErrorScreenV2,
  OverlayHost,
  BottomSheet,
  Dialog,
  TextInput,
  useScreenInsets,
  type ComposeListHandle,
} from '@components';
import { useWindowLayout } from '@hooks/common/useWindowLayout';

const SIDE_PANEL_WIDTH = 400;

const CHAPTERS_PANEL_WIDTH = 400;

const Chapter = ({ route, navigation }: ChapterScreenProps) => (
  <ChapterContextProvider
    novel={route.params.novel}
    initialChapter={route.params.chapter}
  >
    <ReaderDrawerLayout route={route} navigation={navigation} />
  </ChapterContextProvider>
);

const ReaderDrawerLayout = ({ route, navigation }: ChapterScreenProps) => {
  const { loading, novel, openChapter, hideHeader } = useChapterContext();
  const insets = useScreenInsets();
  const { verticalSeekbar = true } = useChapterGeneralSettings();
  const [open, setOpen] = useState(false);
  const [findingChapter, setFindingChapter] = useState(false);
  const drawerListRef = useRef<ComposeListHandle | null>(null);
  /**
   * The drawer renders a list of every chapter in the novel. Mounting it up
   * front competes with the chapter load for the JS thread, so it is deferred
   * until the chapter is on screen -- but it is mounted *before* the drawer is
   * first opened rather than on the tap that opens it. `Drawer` keeps a closed
   * panel laid out (it is only translated off-screen), so the list measures
   * and renders its first rows out of sight instead of during the open
   * animation, which is what left the panel empty on slower devices.
   */
  const [drawerMounted, setDrawerMounted] = useState(false);

  useEffect(() => {
    if (loading || drawerMounted) {
      return;
    }
    const handle = InteractionManager.runAfterInteractions(() =>
      setDrawerMounted(true),
    );
    return () => handle.cancel();
  }, [drawerMounted, loading]);

  useBackHandler(
    useCallback(() => {
      if (open) {
        setOpen(false);
        return true;
      }
      return false;
    }, [open]),
  );

  const openDrawer = useCallback(() => {
    setDrawerMounted(true);
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setOpen(false), []);

  const findChapter = useCallback(() => setFindingChapter(true), []);

  const layout = useWindowLayout();

  return (
    <View style={styles.container}>
      <ChapterContent
        route={route}
        navigation={navigation}
        openDrawer={openDrawer}
      />
      <ReaderSidePanel
        open={open}
        onOpenChange={next => (next ? openDrawer() : closeDrawer())}
        side="start"
        width={Math.min(layout.width - 56, CHAPTERS_PANEL_WIDTH)}
        scrim
        swipeable
        keepMounted
        edgeInsets={{
          top: insets.top + BAR_HEIGHT,
          bottom: insets.bottom + bottomBarHeight(verticalSeekbar),
        }}
        onEdgeTap={hideHeader}
      >
        {drawerMounted ? (
          <ChapterDrawer
            onClose={closeDrawer}
            onFindChapter={findChapter}
            listRef={drawerListRef}
          />
        ) : null}
      </ReaderSidePanel>
      <OverlayHost>
        <JumpToChapterModal
          modalVisible={findingChapter}
          hideModal={() => setFindingChapter(false)}
          novel={novel}
          chapterListRef={drawerListRef}
          onOpenChapter={chapter => {
            closeDrawer();
            openChapter(chapter);
          }}
        />
      </OverlayHost>
    </View>
  );
};

/** Adds a text replacement rule for the selected text. */
const ReplaceTextDialog = ({
  text,
  onSubmit,
  onDismiss,
}: {
  text: string;
  onSubmit: (replacement: string) => void;
  onDismiss: () => void;
}) => {
  const [replacement, setReplacement] = useState('');
  return (
    <Dialog.Root visible onDismiss={onDismiss}>
      <Dialog.Title>
        {`${getString('common.replaceText')}: “${text.slice(0, 60)}”`}
      </Dialog.Title>
      <Dialog.Content>
        <TextInput
          value={replacement}
          label={getString('common.replaceWith')}
          onChangeText={setReplacement}
          onSubmit={() => onSubmit(replacement)}
          autoFocus
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action onPress={() => onSubmit(replacement)}>
          {getString('common.save')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

type ChapterContentProps = ChapterScreenProps & {
  openDrawer: () => void;
};

export const ChapterContent = ({
  navigation,
  openDrawer,
}: ChapterContentProps) => {
  const layout = useWindowLayout();
  const { bottom } = useScreenInsets();
  const { theme: readerBackground } = useChapterReaderSettings();
  const { novel, chapter, loading, error, hideHeader, refetch, selection } =
    useChapterContext();
  const [replacing, setReplacing] = useState<string>();
  const hidden = useReaderChromeHidden();
  const { keepScreenOn } = useChapterGeneralSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>();
  const wide = layout.useNavigationRail;

  useBackHandler(
    useCallback(() => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (searchQuery !== undefined) {
        setSearchQuery(undefined);
        return true;
      }
      return false;
    }, [settingsOpen, searchQuery]),
  );

  // Search belongs to the chrome: it closes when the chrome hides.
  const [wasHidden, setWasHidden] = useState(hidden);
  if (wasHidden !== hidden) {
    setWasHidden(hidden);
    if (hidden && searchQuery !== undefined) {
      setSearchQuery(undefined);
    }
  }

  const openSettings = useCallback(() => {
    // The page stays clean beside the side panel; the sheet keeps the bars.
    if (wide && !hidden) {
      hideHeader();
    }
    setSettingsOpen(true);
  }, [hidden, hideHeader, wide]);

  const chapterUrl = resolveUrl(novel.pluginId, chapter.path);
  const openInWebView = useCallback(
    () =>
      navigation.navigate('WebviewScreen', {
        name: novel.name,
        url: chapter.path,
        pluginId: novel.pluginId,
      }),
    [chapter.path, navigation, novel.name, novel.pluginId],
  );

  const onTextAction = (action: ReaderTextAction, selectedText: string) => {
    const text = (selectedText || selection.text || '').trim();
    selection.clear();
    if (!text) {
      return;
    }
    switch (action) {
      case 'copy':
        void Clipboard.setStringAsync(text);
        showToast(
          getString('common.copiedToClipboard', { name: text.slice(0, 40) }),
        );
        break;
      case 'search':
        if (hidden) {
          hideHeader();
        }
        setSearchQuery(text);
        break;
      case 'remove':
        selection.remove(text);
        break;
      case 'replace':
        setReplacing(text);
        break;
    }
  };

  if (error) {
    return (
      <AppHost style={styles.container}>
        <ErrorScreenV2
          error={error}
          actions={[
            {
              iconName: RefreshIcon,
              title: getString('common.retry'),
              onPress: refetch,
            },
            {
              iconName: PublicIcon,
              title: 'WebView',
              onPress: openInWebView,
            },
          ]}
        />
      </AppHost>
    );
  }

  const closeSettings = () => setSettingsOpen(false);
  const searching = searchQuery !== undefined;

  return (
    <View style={[styles.container, { backgroundColor: readerBackground }]}>
      {keepScreenOn ? <KeepScreenAwake /> : null}
      <WebViewReader onTextAction={onTextAction} />
      {loading ? <ChapterLoadingScreen /> : null}
      <ReaderAppbar
        visible={!hidden}
        onBack={navigation.goBack}
        searchQuery={searchQuery}
        onToggleSearch={() =>
          setSearchQuery(current => (current === undefined ? '' : undefined))
        }
        openInWebView={openInWebView}
        openInBrowser={() => void Linking.openURL(chapterUrl)}
        shareChapter={() => void Share.share({ message: chapterUrl })}
      />
      <ReaderFooter
        visible={!hidden && !searching}
        onOpenChapters={openDrawer}
        onOpenSettings={openSettings}
      />
      <ReaderSideSeekbar visible={!hidden && !searching} />
      <ReaderTtsController />
      {wide ? (
        <ReaderSidePanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          side="end"
          width={SIDE_PANEL_WIDTH}
          title={getString('readerSettings.title')}
        >
          <AppHost style={[styles.container, { paddingBottom: bottom }]}>
            <Column modifiers={[fillMaxSize()]}>
              <ReaderBottomSheet fill />
            </Column>
          </AppHost>
        </ReaderSidePanel>
      ) : null}
      <OverlayHost>
        <BottomSheet
          visible={!wide && settingsOpen}
          onDismiss={closeSettings}
          scrollable={false}
          transparentScrim
        >
          <ReaderBottomSheet bottomInset={bottom} />
        </BottomSheet>
        {replacing !== undefined ? (
          <ReplaceTextDialog
            text={replacing}
            onSubmit={replacement => {
              selection.replace(replacing, replacement);
              setReplacing(undefined);
            }}
            onDismiss={() => setReplacing(undefined)}
          />
        ) : null}
      </OverlayHost>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default Chapter;
