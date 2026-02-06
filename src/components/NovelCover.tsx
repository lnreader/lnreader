import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  Pressable,
  Image,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import ListView from './ListView';

import { useDeviceOrientation } from '@hooks';
import { coverPlaceholderColor } from '../theme/colors';
import { DisplayModes } from '@screens/library/constants/constants';
import { DBNovelInfo, NovelInfo } from '@database/types';
import { NovelItem, ImageRequestInit } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import { useLibrarySettings } from '@hooks/persisted';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { getString } from '@strings/translations';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { defaultCover } from '@plugins/helpers/constants';
import { ActivityIndicator } from 'react-native-paper';

interface UnreadBadgeProps {
  showDownloadBadges: boolean;
  chaptersDownloaded: number | null;
  chaptersUnread: number;
  theme: ThemeColors;
}
interface DownloadBadgeProps {
  showUnreadBadges: boolean;
  chaptersDownloaded: number;
  chaptersUnread: number | null;
  theme: ThemeColors;
}

type CoverItemDB =
  | DBNovelInfo & {
      completeRow?: number;
    };

type CoverItemLibrary =
  | NovelInfo & {
      completeRow?: number;
    };

type CoverItemPlugin =
  | NovelItem & {
      completeRow?: number;
    };

interface INovelCover<TNovel> {
  item: TNovel;
  onPress: () => void;
  libraryStatus: boolean;
  theme: ThemeColors;
  isSelected: boolean;
  addSkeletonLoading?: boolean;
  inActivity?: boolean;
  onLongPress: (item: TNovel) => void;
  selectedNovelIds: number[];
  globalSearch?: boolean;
  imageRequestInit?: ImageRequestInit;
}

function isFromDB(
  item: CoverItemLibrary | CoverItemPlugin | CoverItemDB,
): item is CoverItemDB {
  return 'chaptersDownloaded' in item;
}

function NovelCover<
  TNovel extends CoverItemLibrary | CoverItemPlugin | CoverItemDB,
>({
  item,
  onPress,
  libraryStatus,
  theme,
  isSelected,
  addSkeletonLoading,
  inActivity,
  onLongPress,
  globalSearch,
  selectedNovelIds,
  imageRequestInit,
}: INovelCover<TNovel>) {
  const {
    displayMode = DisplayModes.Comfortable,
    showDownloadBadges = true,
    showUnreadBadges = true,
    novelsPerRow = 3,
  } = useLibrarySettings();

  const window = useWindowDimensions();

  const orientation = useDeviceOrientation();

  const numColumns = useMemo(
    () => (orientation === 'landscape' ? 6 : novelsPerRow),
    [orientation, novelsPerRow],
  );

  const coverHeight = useMemo(() => {
    if (globalSearch) {
      return ((window.width / 3 - 16) * 4) / 3;
    }
    return (window.width / numColumns) * (4 / 3);
  }, [globalSearch, window.width, numColumns]);

  const coverWidth = useMemo(() => {
    if (globalSearch) {
      return window.width / 3 - 16;
    }
    return undefined;
  }, [globalSearch, window.width]);

  const selectNovel = () => onLongPress(item);

  const uri = item.cover || defaultCover;
  const requestInit = imageRequestInit || ({} as ImageRequestInit);
  if (!requestInit.headers) {
    requestInit.headers = {
      'User-Agent': getUserAgent(),
    };
  }

  if (item.completeRow) {
    if (!addSkeletonLoading) {
      return <></>;
    }
    return (
      <SourceScreenSkeletonLoading
        theme={theme}
        completeRow={item.completeRow}
      />
    );
  }

  const flex = globalSearch ? 1 : 1 / numColumns;
  const margin = globalSearch ? 0 : 2;

  return displayMode !== DisplayModes.List || globalSearch ? (
    <View
      style={[
        {
          flex,
          width: coverWidth,
          margin,
        },
        styles.standardNovelCover,
        isSelected && {
          backgroundColor: theme.primary,
          ...styles.selectedNovelCover,
        },
      ]}
    >
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        style={styles.opac}
        onPress={
          selectedNovelIds && selectedNovelIds.length > 0
            ? selectNovel
            : onPress
        }
        onLongPress={selectNovel}
      >
        <View style={styles.badgeContainer}>
          {libraryStatus ? <InLibraryBadge theme={theme} /> : null}
          {isFromDB(item) ? (
            <>
              {showDownloadBadges &&
              item.chaptersDownloaded &&
              item.chaptersDownloaded > 0 ? (
                <DownloadBadge
                  showUnreadBadges={showUnreadBadges}
                  chaptersDownloaded={item.chaptersDownloaded}
                  chaptersUnread={item.chaptersUnread}
                  theme={theme}
                />
              ) : null}
              {showUnreadBadges &&
              item.chaptersUnread &&
              item.chaptersUnread > 0 ? (
                <UnreadBadge
                  theme={theme}
                  chaptersDownloaded={item.chaptersDownloaded}
                  chaptersUnread={item.chaptersUnread}
                  showDownloadBadges={showDownloadBadges}
                />
              ) : null}
            </>
          ) : null}
          {inActivity ? <InActivityBadge theme={theme} /> : null}
        </View>
        <Image
          source={{ uri, ...requestInit }}
          style={[
            {
              height: coverHeight,
              backgroundColor: coverPlaceholderColor,
            },
            styles.standardBorderRadius,
            libraryStatus && styles.opacityPoint5,
          ]}
        />
        <View style={styles.compactTitleContainer}>
          {displayMode === DisplayModes.Compact ? (
            <CompactTitle novelName={item.name} />
          ) : null}
        </View>
        {displayMode === DisplayModes.Comfortable ? (
          <ComfortableTitle
            novelName={item.name}
            theme={theme}
            width={coverWidth}
          />
        ) : null}
      </Pressable>
    </View>
  ) : (
    <ListView
      item={item}
      downloadBadge={
        showDownloadBadges && isFromDB(item) && item.chaptersDownloaded ? (
          <DownloadBadge
            theme={theme}
            showUnreadBadges={showUnreadBadges}
            chaptersDownloaded={item.chaptersDownloaded}
            chaptersUnread={item.chaptersUnread}
          />
        ) : null
      }
      unreadBadge={
        showUnreadBadges && isFromDB(item) && item.chaptersUnread ? (
          <UnreadBadge
            theme={theme}
            chaptersDownloaded={item.chaptersDownloaded}
            chaptersUnread={item.chaptersUnread}
            showDownloadBadges={showDownloadBadges}
          />
        ) : null
      }
      inLibraryBadge={libraryStatus && <InLibraryBadge theme={theme} />}
      theme={theme}
      onPress={
        selectedNovelIds && selectedNovelIds.length > 0 ? selectNovel : onPress
      }
      onLongPress={selectNovel}
      isSelected={isSelected}
    />
  );
}

export default memo(NovelCover);

const ComfortableTitle = ({
  theme,
  novelName,
  width,
}: {
  theme: ThemeColors;
  novelName: string;
  width?: number;
}) => (
  <Text
    numberOfLines={2}
    style={[
      styles.title,
      styles.padding4,
      {
        color: theme.onSurface,
        maxWidth: width,
      },
    ]}
  >
    {novelName}
  </Text>
);

const CompactTitle = ({ novelName }: { novelName: string }) => (
  <View style={styles.titleContainer}>
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.7)']}
      style={styles.linearGradient}
    >
      <Text numberOfLines={2} style={[styles.title, styles.compactTitle]}>
        {novelName}
      </Text>
    </LinearGradient>
  </View>
);

const InLibraryBadge = ({ theme }: { theme: ThemeColors }) => (
  <Text
    style={[
      styles.inLibraryBadge,
      {
        backgroundColor: theme.primary,
        color: theme.onPrimary,
      },
      styles.standardBorderRadius,
    ]}
  >
    {getString('novelScreen.inLibaray')}
  </Text>
);

const InActivityBadge = ({ theme }: { theme: ThemeColors }) => (
  <View
    style={[
      styles.activityBadge,
      {
        backgroundColor: theme.primary,
      },
      styles.standardBorderRadius,
    ]}
  >
    <ActivityIndicator animating={true} size={10} color={theme.onPrimary} />
  </View>
);

const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  chaptersDownloaded,
  chaptersUnread,
  showDownloadBadges,
  theme,
}: UnreadBadgeProps) => (
  <Text
    style={[
      styles.unreadBadge,
      !chaptersDownloaded && styles.LeftBorderRadius,
      !showDownloadBadges && styles.standardBorderRadius,
      {
        backgroundColor: theme.primary,
        color: theme.onPrimary,
      },
    ]}
  >
    {chaptersUnread}
  </Text>
);

const DownloadBadge: React.FC<DownloadBadgeProps> = ({
  chaptersDownloaded,
  showUnreadBadges,
  chaptersUnread,
  theme,
}: DownloadBadgeProps) => (
  <Text
    style={[
      styles.downloadBadge,
      !chaptersUnread && styles.RightBorderRadius,
      !showUnreadBadges && styles.standardBorderRadius,
      {
        backgroundColor: theme.tertiary,
        color: theme.onTertiary,
      },
    ]}
  >
    {chaptersDownloaded}
  </Text>
);

const styles = StyleSheet.create({
  LeftBorderRadius: {
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 4,
  },
  RightBorderRadius: {
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
  },
  activityBadge: {
    marginHorizontal: 4,
    padding: 5,
  },
  badgeContainer: {
    flexDirection: 'row',
    left: 10,
    position: 'absolute',
    top: 10,
    zIndex: 1,
  },
  compactTitle: {
    color: 'rgba(255,255,255,1)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  compactTitleContainer: {
    bottom: 4,
    left: 4,
    position: 'absolute',
    right: 4,
  },
  downloadBadge: {
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 4,
    fontSize: 12,
    paddingHorizontal: 5,
    paddingTop: 2,
  },
  extensionIcon: {
    borderRadius: 4,
    height: 42,
    width: 42,
  },
  inLibraryBadge: {
    fontSize: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  linearGradient: {
    borderRadius: 4,
  },
  listView: {
    alignItems: 'center',
    borderRadius: 4,
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  opac: {
    borderRadius: 4,
    flex: 1,
    padding: 4.8,
  },
  opacityPoint5: { opacity: 0.5 },
  padding4: { padding: 4 },
  selectedNovelCover: {
    opacity: 0.8,
  },
  standardBorderRadius: {
    borderRadius: 4,
  },
  standardNovelCover: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'pt-sans-bold',
    fontSize: 14,
    padding: 8,
  },
  titleContainer: {
    borderRadius: 4,
    flex: 1,
  },
  unreadBadge: {
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
    fontSize: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
});
