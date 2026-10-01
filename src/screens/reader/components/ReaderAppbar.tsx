import { useCallback, useState } from 'react';
import {
  AnimatedVisibility,
  Column,
  EnterTransition,
  ExitTransition,
  Row,
  Surface,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { bookmarkChapter } from '@database/queries/ChapterQueries';
import { useChapterGeneralSettings } from '@hooks/persisted';
import { useTheme } from '@hooks/persisted/useTheme';
import { getString } from '@i18n/translations';
import { useChapterContext } from '../ChapterContext';
import ArrowBackIcon from '@expo/material-symbols/arrow_back.xml';
import BookmarkIcon from '@expo/material-symbols/bookmark.xml';
import BookmarkAddedIcon from '@expo/material-symbols/bookmark_added.xml';
import CloseIcon from '@expo/material-symbols/close.xml';
import HeadphonesIcon from '@expo/material-symbols/headphones.xml';
import OpenInNewIcon from '@expo/material-symbols/open_in_new.xml';
import PublicIcon from '@expo/material-symbols/public.xml';
import RefreshIcon from '@expo/material-symbols/refresh.xml';
import SearchIcon from '@expo/material-symbols/search.xml';
import ShareIcon from '@expo/material-symbols/share.xml';
import {
  AppHost,
  IconButtonV2,
  AppText,
  OverflowMenu,
  useScreenInsets,
  type MenuAction,
} from '@components';
import {
  MAX_CONTENT_WIDTH,
  useWindowLayout,
} from '@hooks/common/useWindowLayout';
import ReaderSearchbar, { SEARCH_HEIGHT } from './ReaderSearchbar';
import { StyleSheet } from 'react-native';

export const BAR_HEIGHT = 64;

export const BAR_BUTTON_WIDTH = 48;

export const slideIn = (from: -1 | 1) =>
  EnterTransition.slideInVertically({ initialOffsetY: from }).plus(
    EnterTransition.fadeIn(),
  );

export const slideOut = (to: -1 | 1) =>
  ExitTransition.slideOutVertically({ targetOffsetY: to }).plus(
    ExitTransition.fadeOut(),
  );

export const useBarGutter = () => {
  const layout = useWindowLayout();
  return Math.max(0, Math.round((layout.width - MAX_CONTENT_WIDTH) / 2));
};

interface ReaderAppbarProps {
  visible: boolean;
  onBack: () => void;
  /** `undefined` hides the search row. */
  searchQuery: string | undefined;
  onToggleSearch: () => void;
  openInWebView: () => void;
  openInBrowser: () => void;
  shareChapter: () => void;
}

const ReaderAppbar = ({
  visible,
  onBack,
  searchQuery,
  onToggleSearch,
  openInWebView,
  openInBrowser,
  shareChapter,
}: ReaderAppbarProps) => {
  const theme = useTheme();
  const { top, left, right } = useScreenInsets();
  const { chapter, novel, refetch, tts } = useChapterContext();
  const { TTSEnable = true } = useChapterGeneralSettings();
  // Bookmark state until the chapter row catches up.
  const [toggled, setToggled] = useState<{
    chapterId: number;
    value: boolean;
  }>();
  const bookmarked =
    toggled?.chapterId === chapter.id
      ? toggled.value
      : Boolean(chapter.bookmark);
  const speaking = tts.state === 'playing' || tts.state === 'paused';
  const searchVisible = searchQuery !== undefined;

  const toggleBookmark = useCallback(() => {
    void bookmarkChapter(chapter.id).then(() =>
      setToggled({ chapterId: chapter.id, value: !bookmarked }),
    );
  }, [bookmarked, chapter.id]);

  const menu: MenuAction[] = [
    {
      label: getString('webview.refresh'),
      icon: RefreshIcon,
      onPress: refetch,
    },
    {
      label: getString('webview.openInWebView'),
      icon: PublicIcon,
      onPress: openInWebView,
    },
    {
      label: getString('webview.openInBrowser'),
      icon: OpenInNewIcon,
      onPress: openInBrowser,
    },
    {
      label: getString('webview.share'),
      icon: ShareIcon,
      onPress: shareChapter,
    },
  ];

  const hostHeight = top + BAR_HEIGHT + (searchVisible ? SEARCH_HEIGHT : 0);
  return (
    <AppHost
      style={[styles.top, { height: hostHeight }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <AnimatedVisibility
        visible={visible}
        enterTransition={slideIn(-1)}
        exitTransition={slideOut(-1)}
        modifiers={[fillMaxWidth()]}
      >
        <Surface
          color={theme.surfaceContainer}
          contentColor={theme.onSurface}
          modifiers={[fillMaxWidth()]}
        >
          <Column modifiers={[fillMaxWidth(), padding(left, top, right, 0)]}>
            <Row
              verticalAlignment="center"
              modifiers={[
                fillMaxWidth(),
                height(BAR_HEIGHT),
                padding(4, 0, 4, 0),
              ]}
            >
              <IconButtonV2
                name={ArrowBackIcon}
                accessibilityLabel={getString('common.back')}
                color={theme.onSurface}
                onPress={onBack}
                theme={theme}
              />
              <Column modifiers={[weight(1), padding(4, 0, 4, 0)]}>
                <AppText variant="titleMedium" maxLines={1}>
                  {novel.name}
                </AppText>
                <AppText
                  variant="bodySmall"
                  color={theme.onSurfaceVariant}
                  maxLines={1}
                >
                  {chapter.name}
                </AppText>
              </Column>
              <IconButtonV2
                name={searchVisible ? CloseIcon : SearchIcon}
                accessibilityLabel={getString('common.search')}
                selected={searchVisible}
                onPress={onToggleSearch}
                theme={theme}
              />
              {TTSEnable ? (
                <IconButtonV2
                  name={HeadphonesIcon}
                  accessibilityLabel={getString(
                    speaking
                      ? 'readerSettings.stopReading'
                      : 'readerSettings.readAloud',
                  )}
                  selected={speaking}
                  onPress={speaking ? tts.stop : tts.start}
                  theme={theme}
                />
              ) : null}
              <IconButtonV2
                name={bookmarked ? BookmarkAddedIcon : BookmarkIcon}
                selected={bookmarked}
                onPress={toggleBookmark}
                theme={theme}
              />
              {!novel.isLocal ? <OverflowMenu actions={menu} /> : null}
            </Row>
            {searchVisible ? (
              <ReaderSearchbar initialQuery={searchQuery} />
            ) : null}
          </Column>
        </Surface>
      </AnimatedVisibility>
    </AppHost>
  );
};

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
});

export default ReaderAppbar;
