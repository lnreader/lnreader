import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import color from 'color';

import * as Clipboard from 'expo-clipboard';

import { IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { showToast } from '@utils/showToast';

import {
  CoverImage,
  NovelInfo,
  NovelInfoContainer,
  NovelThumbnail,
  NovelTitle,
  NovelGenres,
} from './NovelInfoComponents';
import { Row } from '@components/Common';
import ReadButton from './ReadButton';
import NovelSummary from '../NovelSummary/NovelSummary';
import NovelScreenButtonGroup from '../NovelScreenButtonGroup/NovelScreenButtonGroup';
import { getString } from '@strings/translations';
import { filterColor } from '@theme/colors';
import { ChapterInfo, NovelInfo as NovelData } from '@database/types';
import { ThemeColors } from '@theme/types';
import { GlobalSearchScreenProps } from '@navigators/types';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { UseBooleanReturnType } from '@hooks';
import { useAppSettings } from '@hooks/persisted';
import { NovelStatus, PluginItem } from '@plugins/types';
import { translateNovelStatus } from '@utils/translateEnum';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { AVAILABLE_PLUGINS } from '@hooks/persisted/usePlugins';

import {
  NovelMetaSkeleton,
  VerticalBarSkeleton,
} from '@components/Skeleton/Skeleton';
import { useNovelContext } from '@screens/novel/NovelContext';
import { ChapterFilterKey } from '@database/constants';

interface NovelInfoHeaderProps {
  chapters: ChapterInfo[];
  deleteDownloadsSnackbar: UseBooleanReturnType;
  fetching: boolean;
  filter: ChapterFilterKey[];
  isLoading: boolean;
  lastRead?: ChapterInfo;
  navigateToChapter: (chapter: ChapterInfo) => void;
  navigation: GlobalSearchScreenProps['navigation'];
  novel: NovelData | (Omit<NovelData, 'id'> & { id: 'NO_ID' });
  novelBottomSheetRef: React.RefObject<BottomSheetModalMethods | null>;
  onRefreshPage: (page: string) => void;
  page?: string;
  pageIndex: number;
  pages: string[];
  pageNavigationSheetRef: React.RefObject<BottomSheetModalMethods | null>;
  setCustomNovelCover: () => Promise<void>;
  saveNovelCover: () => Promise<void>;
  theme: ThemeColors;
  totalChapters?: number;
  trackerSheetRef: React.RefObject<BottomSheetModalMethods | null>;
}

const getStatusIcon = (status?: string) => {
  if (status === NovelStatus.Ongoing) {
    return 'clock-outline';
  }
  if (status === NovelStatus.Completed) {
    return 'check-all';
  }
  return 'help';
};

const NovelInfoHeader = ({
  chapters,
  deleteDownloadsSnackbar,
  fetching,
  filter,
  isLoading = false,
  lastRead,
  navigateToChapter,
  navigation,
  novel,
  novelBottomSheetRef,
  setCustomNovelCover,
  saveNovelCover,
  theme,
  totalChapters,
  trackerSheetRef,
}: NovelInfoHeaderProps) => {
  const { hideBackdrop = false } = useAppSettings();
  const { followNovel } = useNovelContext();

  const pluginName = useMemo(
    () =>
      (getMMKVObject<PluginItem[]>(AVAILABLE_PLUGINS) || []).find(
        plugin => plugin.id === novel.pluginId,
      )?.name || novel.pluginId,
    [novel.pluginId],
  );

  const showNotAvailable = async () => {
    showToast('Not available while loading');
  };

  return (
    <>
      <CoverImage
        source={{ uri: novel.cover ?? undefined }}
        theme={theme}
        hideBackdrop={hideBackdrop}
      >
        <NovelInfoContainer>
          <NovelThumbnail
            source={{ uri: novel.cover ?? undefined }}
            theme={theme}
            setCustomNovelCover={
              isLoading ? showNotAvailable : setCustomNovelCover
            }
            saveNovelCover={isLoading ? showNotAvailable : saveNovelCover}
          />
          <View style={styles.novelDetails}>
            <Row>
              <NovelTitle
                theme={theme}
                onPress={() =>
                  navigation.replace('GlobalSearchScreen', {
                    searchText: novel.name,
                  })
                }
                onLongPress={() => {
                  Clipboard.setStringAsync(novel.name).then(() =>
                    showToast(
                      getString('common.copiedToClipboard', {
                        name: novel.name,
                      }),
                    ),
                  );
                }}
              >
                {novel.name}
              </NovelTitle>
            </Row>
            {novel.id !== 'NO_ID' && novel.author ? (
              <Row>
                <MaterialCommunityIcons
                  name="fountain-pen-tip"
                  size={14}
                  color={theme.onSurfaceVariant}
                  style={styles.marginRight}
                />
                <NovelInfo theme={theme}>{novel.author}</NovelInfo>
              </Row>
            ) : null}
            {novel.id !== 'NO_ID' && novel.artist ? (
              <Row>
                <MaterialCommunityIcons
                  name="palette-outline"
                  size={14}
                  color={theme.onSurfaceVariant}
                  style={styles.marginRight}
                />
                <NovelInfo theme={theme}>{novel.artist}</NovelInfo>
              </Row>
            ) : null}
            <Row>
              <MaterialCommunityIcons
                name={getStatusIcon(
                  novel.id !== 'NO_ID' ? novel.status ?? undefined : undefined,
                )}
                size={14}
                color={theme.onSurfaceVariant}
                style={styles.marginRight}
              />
              <NovelInfo theme={theme}>
                {(novel.id !== 'NO_ID'
                  ? translateNovelStatus(novel.status ?? undefined)
                  : getString('novelScreen.unknownStatus')) +
                  ' • ' +
                  pluginName}
              </NovelInfo>
            </Row>
          </View>
        </NovelInfoContainer>
      </CoverImage>
      <>
        <NovelScreenButtonGroup
          novel={novel}
          handleFollowNovel={
            isLoading
              ? showNotAvailable
              : () => {
                  followNovel();
                  if (
                    novel.inLibrary &&
                    chapters.some(chapter => chapter.isDownloaded)
                  ) {
                    deleteDownloadsSnackbar.setTrue();
                  }
                }
          }
          handleTrackerSheet={() => trackerSheetRef.current?.present()}
          theme={theme}
        />
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
          chapters={chapters}
          lastRead={lastRead}
        />
        {isLoading && (!novel.genres || !novel.summary) ? (
          <VerticalBarSkeleton />
        ) : (
          <View style={styles.bottomsheetContainer}>
            <Pressable
              style={styles.bottomsheet}
              onPress={() => novelBottomSheetRef.current?.present()}
              android_ripple={{
                color: color(theme.primary).alpha(0.12).string(),
              }}
            >
              <View style={styles.flex}>
                <Text style={[{ color: theme.onSurface }, styles.chapters]}>
                  {!fetching || totalChapters !== undefined
                    ? `${totalChapters} ${getString('novelScreen.chapters')}`
                    : getString('common.loading')}
                </Text>
              </View>
              <IconButton
                icon="filter-variant"
                iconColor={
                  filter.length >= 1
                    ? filterColor(theme.isDark)
                    : theme.onSurface
                }
                size={24}
                onPress={() => novelBottomSheetRef.current?.present()}
              />
            </Pressable>
          </View>
        )}
      </>
    </>
  );
};

export default memo(NovelInfoHeader);

const styles = StyleSheet.create({
  bottomsheet: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 12,
    paddingVertical: 8,
  },
  bottomsheetContainer: {
    gap: 12,
  },
  chapters: {
    fontSize: 14,
    paddingHorizontal: 16,
  },
  flex: { flex: 1 },
  marginRight: { marginRight: 4 },
  novelDetails: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingBottom: 16,
    paddingLeft: 12,
  },
});
