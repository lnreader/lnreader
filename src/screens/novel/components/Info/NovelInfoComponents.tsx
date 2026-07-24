import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View, Pressable } from 'react-native';
import { ImageBackground, type ImageSource } from 'expo-image';
import color from 'color';
import { IconButton, Portal } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Chip, NovelCoverImage } from '../../../../components';
import { isMissingNovelCover } from '../../../../components/NovelCoverImage';
import { ThemeColors } from '@theme/types';
import { getString } from '@i18n/translations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CoverImageProps {
  children: React.ReactNode;
  source: ImageSource;
  theme: ThemeColors;
  hideBackdrop: boolean;
}

interface NovelThumbnailProps {
  source: ImageSource;
  theme: ThemeColors;
  setCustomNovelCover: () => Promise<void>;
  saveNovelCover: () => Promise<void>;
}

interface NovelTitleProps {
  theme: ThemeColors;
  children: React.ReactNode;
  onLongPress: () => void;
  onPress: () => void;
}

const NovelInfoContainer = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.novelInfoContainer}>{children}</View>
);

const CoverImage = memo(
  ({ children, source, theme, hideBackdrop }: CoverImageProps) => {
    const [failedUri, setFailedUri] = useState<string>();
    const overlayBg = useMemo(
      () => color(theme.background).alpha(0.7).string(),
      [theme.background],
    );
    const overlayStyle = useMemo(
      () => [{ backgroundColor: overlayBg }, styles.flex1],
      [overlayBg],
    );
    const gradientColors = useMemo(
      () => ['rgba(0,0,0,0)', theme.background] as const,
      [theme.background],
    );

    if (hideBackdrop) {
      return <View>{children}</View>;
    }

    const showPlaceholder =
      isMissingNovelCover(source.uri) || failedUri === source.uri;
    const content = (
      <View style={overlayStyle}>
        {!showPlaceholder ? (
          <LinearGradient
            colors={gradientColors}
            locations={GRADIENT_LOCATIONS}
            style={styles.linearGradient}
          >
            {children}
          </LinearGradient>
        ) : (
          children
        )}
      </View>
    );

    if (showPlaceholder) {
      return (
        <View
          style={[styles.coverImage, { backgroundColor: theme.background }]}
        >
          {content}
        </View>
      );
    }

    return (
      <ImageBackground
        cachePolicy="memory-disk"
        contentFit="cover"
        onError={() => setFailedUri(source.uri)}
        source={source}
        style={styles.coverImage}
      >
        {content}
      </ImageBackground>
    );
  },
);

const GRADIENT_LOCATIONS = [0, 1] as const;

const NovelThumbnail = ({
  source,
  theme,
  setCustomNovelCover,
  saveNovelCover,
}: NovelThumbnailProps) => {
  const [expanded, setExpanded] = useState(false);
  const { top, right } = useSafeAreaInsets();

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={styles.novelThumbnailContainer}
    >
      {!expanded ? (
        <NovelCoverImage
          uri={source.uri}
          theme={theme}
          iconSize={36}
          style={styles.novelThumbnail}
        />
      ) : (
        <Portal>
          <IconButton
            icon="content-save"
            style={[
              styles.absoluteIcon,
              styles.zIndex,
              { top: top + 6, right: right + 6 },
            ]}
            iconColor={theme.onBackground}
            onPress={saveNovelCover}
          />
          <IconButton
            icon="pencil-outline"
            style={[
              styles.absoluteIcon,
              styles.zIndex,
              { top: top + 6, right: right + 60 },
            ]}
            iconColor={theme.onBackground}
            onPress={setCustomNovelCover}
          />
          <Pressable
            style={[styles.expandedOverlay]}
            onPress={() => setExpanded(false)}
          >
            <NovelCoverImage
              uri={source.uri}
              theme={theme}
              iconSize={64}
              contentFit="contain"
              style={styles.flex1}
            />
          </Pressable>
        </Portal>
      )}
    </Pressable>
  );
};

const NovelTitle = ({
  theme,
  children,
  onLongPress,
  onPress,
}: NovelTitleProps) => (
  <Text
    onLongPress={onLongPress}
    onPress={onPress}
    style={[{ color: theme.onBackground }, styles.novelTitle]}
    numberOfLines={4}
  >
    {children}
  </Text>
);

const NovelInfo = ({
  theme,
  children,
}: {
  theme: ThemeColors;
  children: React.ReactNode;
}) => (
  <Text
    style={[{ color: theme.onSurfaceVariant }, styles.novelInfo]}
    numberOfLines={1}
  >
    {children}
  </Text>
);

const FollowButton = ({
  theme,
  onPress,
  followed,
}: {
  theme: ThemeColors;
  onPress: () => void;
  followed: boolean;
}) => (
  <View style={styles.followButtonContainer}>
    <Pressable
      android_ripple={{
        color: theme.rippleColor,
        borderless: false,
      }}
      onPress={onPress}
      style={styles.followButtonPressable}
    >
      <IconButton
        icon={followed ? 'heart' : 'heart-outline'}
        iconColor={followed ? theme.primary : theme.outline}
        size={24}
        style={styles.iconButton}
      />
      <Text
        style={[
          { color: followed ? theme.primary : theme.outline },
          styles.followButtonText,
        ]}
      >
        {followed
          ? getString('novelScreen.inLibaray')
          : getString('novelScreen.addToLibaray')}
      </Text>
    </Pressable>
  </View>
);

const TrackerButton = ({
  theme,
  isTracked,
  onPress,
}: {
  theme: ThemeColors;
  onPress: () => void;
  isTracked: boolean;
}) => (
  <View style={styles.followButtonContainer}>
    <Pressable
      android_ripple={{
        color: theme.rippleColor,
        borderless: false,
      }}
      onPress={onPress}
      style={styles.followButtonPressable}
    >
      <IconButton
        icon={isTracked ? 'check' : 'sync'}
        iconColor={isTracked ? theme.primary : theme.outline}
        size={24}
        style={styles.iconButton}
      />
      <Text
        style={[
          { color: isTracked ? theme.primary : theme.outline },
          styles.followButtonText,
        ]}
      >
        {isTracked
          ? getString('novelScreen.tracked')
          : getString('novelScreen.tracking')}
      </Text>
    </Pressable>
  </View>
);

const genreKeyExtractor = (_item: string, index: number) => 'genre' + index;

const NovelGenres = memo(
  ({ theme, genres }: { theme: ThemeColors; genres: string }) => {
    const data = useMemo(() => genres.split(/,\s*/), [genres]);
    const renderGenre = useCallback(
      ({ item }: { item: string }) => <Chip label={item} theme={theme} />,
      [theme],
    );

    return (
      <FlatList
        contentContainerStyle={styles.genreContainer}
        horizontal
        data={data}
        keyExtractor={genreKeyExtractor}
        renderItem={renderGenre}
        showsHorizontalScrollIndicator={false}
      />
    );
  },
);

export {
  NovelInfoContainer,
  CoverImage,
  NovelThumbnail,
  NovelTitle,
  NovelInfo,
  FollowButton,
  TrackerButton,
  NovelGenres,
};

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  coverImage: {},
  absoluteIcon: {
    position: 'absolute',
  },
  expandedOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  followButtonContainer: {
    borderRadius: 4,
    overflow: 'hidden',
    flex: 1,
  },
  followButtonPressable: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  followButtonText: {
    fontSize: 12,
  },
  iconButton: {
    margin: 0,
  },
  genreChip: {
    borderRadius: 50,
    flex: 1,
    fontSize: 12,
    justifyContent: 'center',
    marginHorizontal: 2,
    paddingHorizontal: 12,
    paddingVertical: 5,
    textTransform: 'capitalize',
  },
  genreContainer: {
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  linearGradient: {
    flex: 1,
  },
  novelInfo: {
    fontSize: 14,
  },
  novelInfoContainer: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    marginTop: 28,
    paddingTop: 90,
  },
  novelThumbnail: {
    borderRadius: 6,
    height: 150,
    width: 100,
  },
  novelThumbnailContainer: {
    height: 150,
    marginHorizontal: 4,
    width: 100,
  },
  novelTitle: {
    fontSize: 20,
  },
  zIndex: { zIndex: 10 },
});
