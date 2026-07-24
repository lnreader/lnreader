import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

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
import { getString } from '@i18n/translations';
import { filterColor } from '@theme/colors';
import { ChapterInfo, NovelInfo as NovelData } from '@database/types';
import { ThemeColors } from '@theme/types';
import { NovelScreenProps } from '@navigators/types';
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
import { ChapterFilterKey } from '@database/constants';
import { useNovelAction } from '@screens/novel/NovelContext';
import { useNavigation } from '@react-navigation/native';
import {
  ButtonGroupSkeleton,
  ChapterCountSkeleton,
  NovelDetailsSkeleton,
} from './NovelInfoSkeletons';

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
  novelBottomSheetRef: React.RefObject<BottomSheetModalMethods | null>;
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
  novelBottomSheetRef,
  setCustomNovelCover,
  saveNovelCover,
  theme,
  totalChapters,
  trackerSheetRef,
}: NovelInfoHeaderProps) => {
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

  const coverSource = useMemo(
    () => ({ uri: novel.cover ?? undefined }),
    [novel.cover],
  );

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

  const handleTrackerSheet = useCallback(
    () => trackerSheetRef.current?.present(),
    [trackerSheetRef],
  );

  const handleOpenBottomSheet = useCallback(
    () => novelBottomSheetRef.current?.present(),
    [novelBottomSheetRef],
  );

  const ripple = useMemo(
    () => ({ color: theme.rippleColor }),
    [theme.rippleColor],
  );

  return (
    <>
      <CoverImage
        source={coverSource}
        theme={theme}
        hideBackdrop={hideBackdrop}
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
          <View style={styles.novelDetails}>
            <Row style={styles.infoRow}>
              <NovelTitle
                theme={theme}
                onPress={handleTitlePress}
                onLongPress={handleTitleLongPress}
              >
                {novel.name}
              </NovelTitle>
            </Row>
            {isLoading && novel.id === 'NO_ID' ? (
              <NovelDetailsSkeleton theme={theme} />
            ) : (
              <>
                {novel.id !== 'NO_ID' && novel.author ? (
                  <Row style={styles.infoRow}>
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
                  <Row style={styles.infoRow}>
                    <MaterialCommunityIcons
                      name="palette-outline"
                      size={14}
                      color={theme.onSurfaceVariant}
                      style={styles.marginRight}
                    />
                    <NovelInfo theme={theme}>{novel.artist}</NovelInfo>
                  </Row>
                ) : null}
                <Row style={styles.infoRow}>
                  <MaterialCommunityIcons
                    name={getStatusIcon(novelStatus)}
                    size={14}
                    color={theme.onSurfaceVariant}
                    style={styles.marginRight}
                  />
                  <NovelInfo theme={theme}>
                    {(novelStatus
                      ? translateNovelStatus(novelStatus)
                      : getString('novelScreen.unknownStatus')) +
                      ' • ' +
                      pluginName}
                  </NovelInfo>
                </Row>
              </>
            )}
          </View>
        </NovelInfoContainer>
      </CoverImage>
      <>
        {isLoading && novel.id === 'NO_ID' ? (
          <ButtonGroupSkeleton theme={theme} />
        ) : (
          <NovelScreenButtonGroup
            novel={novel}
            handleFollowNovel={handleFollowNovel}
            handleTrackerSheet={handleTrackerSheet}
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
          <View style={styles.bottomsheetContainer}>
            <Pressable
              style={styles.bottomsheet}
              onPress={handleOpenBottomSheet}
              android_ripple={ripple}
            >
              <View style={styles.flex}>
                {fetching && totalChapters === undefined ? (
                  <ChapterCountSkeleton theme={theme} />
                ) : (
                  <Text style={[{ color: theme.onSurface }, styles.chapters]}>
                    {`${totalChapters ?? 0} ${getString(
                      'novelScreen.chapters',
                    )}`}
                  </Text>
                )}
              </View>
              <IconButton
                icon="filter-variant"
                iconColor={
                  filter.length > 0
                    ? filterColor(theme.isDark)
                    : theme.onSurface
                }
                size={24}
                onPress={handleOpenBottomSheet}
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
  infoRow: {
    marginBottom: 8,
  },
});
