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
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import useLoadingColors from '@utils/useLoadingColors';
import { ChapterFilterKey } from '@database/constants';
import { useNovelAction } from '@screens/novel/NovelContext';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface NovelInfoHeaderProps {
  chapters: ChapterInfo[];
  deleteDownloadSnackbar?: UseBooleanReturnType;
  fetching: boolean;
  filter?: ChapterFilterKey[];
  firstUnreadChapter?: ChapterInfo;
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

const useShimmer = (theme: ThemeColors) => {
  const translateX = useSharedValue(-100);
  const [highlightColor, backgroundColor, disableLoadingAnimations] =
    useLoadingColors(theme);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: (translateX.value + '%') as `${number}%`,
      },
    ],
  }));

  React.useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = -100;
    if (!disableLoadingAnimations) {
      translateX.value = withRepeat(
        withTiming(200, { duration: 1000 }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(translateX);
  }, [disableLoadingAnimations, translateX]);

  return {
    animatedStyle,
    highlightColor,
    backgroundColor,
    disableLoadingAnimations,
  };
};

const ChapterCountSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const {
    animatedStyle,
    highlightColor,
    backgroundColor,
    disableLoadingAnimations,
  } = useShimmer(theme);

  return (
    <View
      style={[
        styles.chapterCountSkeleton,
        { backgroundColor: backgroundColor },
      ]}
    >
      {!disableLoadingAnimations ? (
        <AnimatedLinearGradient
          start={[0, 0]}
          end={[1, 0]}
          locations={[0, 0.3, 0.7, 1]}
          style={[styles.chapterCountGradient, animatedStyle]}
          colors={[
            'transparent',
            highlightColor,
            highlightColor,
            'transparent',
          ]}
        />
      ) : null}
    </View>
  );
};

const NovelDetailsSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const {
    animatedStyle,
    highlightColor,
    backgroundColor,
    disableLoadingAnimations,
  } = useShimmer(theme);

  const shimmer = !disableLoadingAnimations ? (
    <AnimatedLinearGradient
      start={[0, 0]}
      end={[1, 0]}
      locations={[0, 0.3, 0.7, 1]}
      style={[styles.infoSkeletonGradient, animatedStyle]}
      colors={['transparent', highlightColor, highlightColor, 'transparent']}
    />
  ) : null;

  return (
    <>
      <Row style={styles.infoRow}>
        <View
          style={[styles.infoSkeletonBar, styles.w130, { backgroundColor }]}
        >
          {shimmer}
        </View>
      </Row>
      <Row style={styles.infoRow}>
        <View
          style={[styles.infoSkeletonBar, styles.w180, { backgroundColor }]}
        >
          {shimmer}
        </View>
      </Row>
    </>
  );
};

const ButtonGroupSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const {
    animatedStyle,
    highlightColor,
    backgroundColor,
    disableLoadingAnimations,
  } = useShimmer(theme);

  const shimmer = !disableLoadingAnimations ? (
    <AnimatedLinearGradient
      start={[0, 0]}
      end={[1, 0]}
      locations={[0, 0.3, 0.7, 1]}
      style={[styles.buttonSkeletonGradient, animatedStyle]}
      colors={['transparent', highlightColor, highlightColor, 'transparent']}
    />
  ) : null;

  return (
    <View style={styles.buttonGroupSkeletonContainer}>
      <View style={[styles.buttonSkeleton, { backgroundColor }]}>
        {shimmer}
      </View>
      <View style={[styles.buttonSkeleton, { backgroundColor }]}>
        {shimmer}
      </View>
    </View>
  );
};

const showNotAvailable = async () => {
  showToast('Not available while loading');
};

const NovelInfoHeader = ({
  chapters,
  deleteDownloadSnackbar,
  fetching,
  filter = [],
  firstUnreadChapter,
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

  const handleFollowNovel = useCallback(() => {
    if (isLoading) {
      showNotAvailable();
      return;
    }
    followNovel().catch(error =>
      showToast('Failed updating: ' + (error as Error).message),
    );
    if (novel.inLibrary && chapters.some(chapter => chapter.isDownloaded)) {
      deleteDownloadSnackbar?.setTrue();
    } else {
      deleteDownloadSnackbar?.setFalse();
    }
  }, [
    isLoading,
    followNovel,
    novel.inLibrary,
    chapters,
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
  chapterCountGradient: {
    height: 20,
    position: 'absolute',
    width: '60%',
  },
  chapterCountSkeleton: {
    borderRadius: 4,
    height: 14,
    marginHorizontal: 16,
    overflow: 'hidden',
    width: 120,
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
  infoSkeletonBar: {
    borderRadius: 4,
    height: 14,
    overflow: 'hidden',
  },
  infoSkeletonGradient: {
    height: 20,
    position: 'absolute',
    width: '60%',
  },
  buttonGroupSkeletonContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  buttonSkeleton: {
    borderRadius: 8,
    flex: 1,
    height: 52,
    overflow: 'hidden',
  },
  buttonSkeletonGradient: {
    height: 60,
    position: 'absolute',
    width: '60%',
  },
  w130: {
    width: 130,
  },
  w180: {
    width: 180,
  },
});
