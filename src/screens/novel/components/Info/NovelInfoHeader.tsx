import { memo, useCallback, useMemo } from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import * as Clipboard from 'expo-clipboard';

import { showToast } from '@utils/showToast';

import {
  CoverImage,
  NovelInfo,
  NovelInfoContainer,
  NovelThumbnail,
  NovelTitle,
  NovelGenres,
} from './NovelInfoComponents';
import ReadButton from './ReadButton';
import {
  NovelMetaSkeleton,
  VerticalBarSkeleton,
} from '@components/Skeleton/Skeleton';
import {
  ButtonGroupSkeleton,
  ChapterCountSkeleton,
  NovelDetailsSkeleton,
} from './NovelInfoSkeletons';
import NovelSummary from '../NovelSummary/NovelSummary';
import NovelScreenButtonGroup from '../NovelScreenButtonGroup/NovelScreenButtonGroup';
import { getString } from '@i18n/translations';
import { filterColor } from '@theme/colors';
import { ChapterInfo, NovelInfo as NovelData } from '@database/types';
import { ThemeColors } from '@theme/types';
import { NovelScreenProps } from '@navigators/types';
import { UseBooleanReturnType } from '@hooks';
import { useAppSettings } from '@hooks/persisted';
import { NovelStatus, PluginItem } from '@plugins/types';
import { translateNovelStatus } from '@utils/translateEnum';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { AVAILABLE_PLUGINS } from '@hooks/persisted/usePlugins';
import { getPlugin } from '@plugins/pluginManager';
import {
  AppIcon,
  AppText,
  IconButtonV2,
  useScreenInsets,
  type IconSource,
} from '@components';
import { ChapterFilterKey } from '@database/constants';
import { useNovelAction } from '@screens/novel/NovelContext';
import { useNavigation } from '@react-navigation/native';
import CancelIcon from '@expo/material-symbols/cancel.xml';
import CopyrightIcon from '@expo/material-symbols/copyright.xml';
import DoneAllIcon from '@expo/material-symbols/done_all.xml';
import FilterListIcon from '@expo/material-symbols/filter_list.xml';
import HelpIcon from '@expo/material-symbols/help.xml';
import InkPenIcon from '@expo/material-symbols/ink_pen.xml';
import MenuBookIcon from '@expo/material-symbols/menu_book.xml';
import PaletteIcon from '@expo/material-symbols/palette.xml';
import PauseCircleIcon from '@expo/material-symbols/pause_circle.xml';
import ScheduleIcon from '@expo/material-symbols/schedule.xml';
import BedtimeIcon from '@expo/material-symbols/bedtime.xml';
import BookIcon from '@expo/material-symbols/book.xml';

interface NovelInfoHeaderProps {
  hasDownloadedChapters: boolean;
  deleteDownloadSnackbar?: UseBooleanReturnType;
  fetching: boolean;
  filter?: ChapterFilterKey[];
  firstUnreadChapter?: ChapterInfo;
  isLoading: boolean;
  lastRead?: ChapterInfo;
  navigateToChapter: (chapter: ChapterInfo) => void;
  novel: NovelData | (Omit<NovelData, 'id'> & { id: 'NO_ID' });
  openNovelBottomSheet: () => void;
  setCustomNovelCover: () => Promise<void>;
  saveNovelCover: () => Promise<void>;
  theme: ThemeColors;
  totalChapters?: number;
  openTrackerSheet: () => void;
  /** Phones draw the top bar over the backdrop. */
  underTopBar?: boolean;
}

const STATUS_ICON_MAP: Record<string, IconSource> = {
  [NovelStatus.Ongoing]: ScheduleIcon,
  [NovelStatus.Completed]: DoneAllIcon,
  [NovelStatus.OnHiatus]: PauseCircleIcon,
  [NovelStatus.Cancelled]: CancelIcon,
  [NovelStatus.Licensed]: CopyrightIcon,
  [NovelStatus.PublishingFinished]: MenuBookIcon,
  [NovelStatus.Unknown]: HelpIcon,
  [NovelStatus.STUB]: BookIcon,
  [NovelStatus.Inactive]: BedtimeIcon,
};

const getStatusIcon = (status?: string) =>
  (status && STATUS_ICON_MAP[status]) || HelpIcon;

const showNotAvailable = () => {
  showToast('Not available while loading');
};

const NovelInfoHeader = ({
  hasDownloadedChapters,
  deleteDownloadSnackbar,
  fetching,
  filter = [],
  firstUnreadChapter,
  isLoading = false,
  lastRead,
  navigateToChapter,
  novel,
  openNovelBottomSheet,
  setCustomNovelCover,
  saveNovelCover,
  theme,
  totalChapters,
  openTrackerSheet,
  underTopBar = false,
}: NovelInfoHeaderProps) => {
  const { top } = useScreenInsets();
  const { hideBackdrop = false } = useAppSettings();
  const navigation = useNavigation<NovelScreenProps['navigation']>();
  const followNovel = useNovelAction('followNovel');

  const pluginName = useMemo(
    () =>
      (getMMKVObject<PluginItem[]>(AVAILABLE_PLUGINS) || []).find(
        plugin => plugin.id === novel.pluginId,
      )?.name || novel.pluginId,
    [novel.pluginId],
  );

  const coverSource = useMemo(() => {
    const imageRequestInit = getPlugin(novel.pluginId)?.imageRequestInit;
    return {
      uri: novel.cover ?? undefined,
      headers: imageRequestInit?.headers,
    };
  }, [novel.pluginId, novel.cover]);

  const novelStatus = useMemo(
    () => (novel.id !== 'NO_ID' ? novel.status ?? undefined : undefined),
    [novel.id, novel.status],
  );

  const handleTitlePress = useCallback(
    () =>
      navigation.replace('GlobalSearchScreen', {
        searchText: novel.name,
      }),
    [navigation, novel.name],
  );

  const handleTitleLongPress = useCallback(() => {
    Clipboard.setStringAsync(novel.name).then(() =>
      showToast(getString('common.copiedToClipboard', { name: novel.name })),
    );
  }, [novel.name]);

  const handleFollowNovel = useCallback(async () => {
    if (isLoading) {
      showNotAvailable();
      return;
    }
    try {
      await followNovel();
      if (novel.inLibrary && hasDownloadedChapters) {
        deleteDownloadSnackbar?.setTrue();
      } else {
        deleteDownloadSnackbar?.setFalse();
      }
    } catch (error) {
      showToast(
        'Failed updating: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }, [
    isLoading,
    followNovel,
    novel.inLibrary,
    hasDownloadedChapters,
    deleteDownloadSnackbar,
  ]);

  const detail = (icon: IconSource, text: string) => (
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 6 }}>
      <AppIcon source={icon} size={14} tint={theme.onSurfaceVariant} />
      <NovelInfo theme={theme}>{text}</NovelInfo>
    </Row>
  );

  return (
    <Column modifiers={[fillMaxWidth()]}>
      <CoverImage
        source={coverSource}
        theme={theme}
        // The tablet pane sits on its own surface, with no backdrop.
        hideBackdrop={hideBackdrop || !underTopBar}
        topPadding={underTopBar ? top + 64 : 0}
      >
        <NovelInfoContainer>
          <NovelThumbnail
            source={coverSource}
            theme={theme}
            setCustomNovelCover={
              isLoading ? showNotAvailable : setCustomNovelCover
            }
            saveNovelCover={isLoading ? showNotAvailable : saveNovelCover}
          />
          <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[weight(1)]}>
            <NovelTitle
              theme={theme}
              onPress={handleTitlePress}
              onLongPress={handleTitleLongPress}
            >
              {novel.name}
            </NovelTitle>
            {isLoading && novel.id === 'NO_ID' ? (
              <NovelDetailsSkeleton theme={theme} />
            ) : (
              <>
                {novel.id !== 'NO_ID' && novel.author
                  ? detail(InkPenIcon, novel.author)
                  : null}
                {novel.id !== 'NO_ID' && novel.artist
                  ? detail(PaletteIcon, novel.artist)
                  : null}
                {detail(
                  getStatusIcon(novelStatus),
                  (novelStatus
                    ? translateNovelStatus(novelStatus)
                    : getString('novelScreen.unknownStatus')) +
                    ' • ' +
                    pluginName,
                )}
              </>
            )}
          </Column>
        </NovelInfoContainer>
      </CoverImage>
      {isLoading && novel.id === 'NO_ID' ? (
        <ButtonGroupSkeleton theme={theme} />
      ) : (
        <NovelScreenButtonGroup
          novel={novel}
          handleFollowNovel={handleFollowNovel}
          handleTrackerSheet={openTrackerSheet}
          theme={theme}
        />
      )}
      {isLoading && (!novel.genres || !novel.summary) ? (
        <NovelMetaSkeleton />
      ) : (
        <>
          <NovelSummary
            summary={novel.summary || getString('novelScreen.noSummary')}
            isExpanded={!novel.inLibrary}
            theme={theme}
          />
          {novel.genres ? (
            <NovelGenres theme={theme} genres={novel.genres} />
          ) : null}
        </>
      )}
      <ReadButton
        navigateToChapter={navigateToChapter}
        firstUnreadChapter={firstUnreadChapter}
        lastRead={lastRead}
      />
      {isLoading && (!novel.genres || !novel.summary) ? (
        <VerticalBarSkeleton />
      ) : (
        <Row
          verticalAlignment="center"
          modifiers={[
            fillMaxWidth(),
            clickable(openNovelBottomSheet),
            padding(16, 4, 4, 4),
          ]}
        >
          <Box modifiers={[weight(1)]}>
            {fetching && totalChapters === undefined ? (
              <ChapterCountSkeleton theme={theme} />
            ) : (
              <AppText variant="titleMedium" color={theme.onSurface}>
                {`${totalChapters ?? 0} ${getString('novelScreen.chapters')}`}
              </AppText>
            )}
          </Box>
          <IconButtonV2
            name={FilterListIcon}
            color={
              filter.length > 0 ? filterColor(theme.isDark) : theme.onSurface
            }
            onPress={openNovelBottomSheet}
            theme={theme}
          />
        </Row>
      )}
    </Column>
  );
};

export default memo(NovelInfoHeader);
