import { memo, useState } from 'react';
import {
  Image as ReactNativeImage,
  type ImageStyle,
  type ImageURISource,
  type StyleProp,
  StyleSheet,
  View,
} from 'react-native';
import { Image, type ImageContentFit, type ImageProps } from 'expo-image';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import Color from 'color';

import { defaultCover } from '@plugins/helpers/constants';
import type { ImageRequestInit } from '@plugins/types';
import type { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted/useSettings';

interface NovelCoverImageProps
  extends Pick<
    ImageProps,
    | 'accessibilityLabel'
    | 'accessible'
    | 'cachePolicy'
    | 'contentFit'
    | 'onError'
    | 'onLayout'
    | 'priority'
    | 'recyclingKey'
    | 'testID'
    | 'transition'
  > {
  iconSize?: number;
  requestInit?: ImageRequestInit;
  style?: StyleProp<ImageStyle>;
  theme: ThemeColors;
  uri?: string | null;
}

export const isMissingNovelCover = (uri?: string | null) => {
  const normalizedUri = uri?.trim();
  return !normalizedUri || normalizedUri === defaultCover;
};

const minTileContrast = 1.35;
const minIconContrast = 4.5;

type PlaceholderColors = { backgroundColor: string; iconColor: string };

const placeholderColorsByTheme = new WeakMap<ThemeColors, PlaceholderColors>();

const getPlaceholderColors = (theme: ThemeColors): PlaceholderColors => {
  const cached = placeholderColorsByTheme.get(theme);
  if (cached) return cached;

  const background = Color(theme.background ?? theme.surfaceVariant);
  const themeIcon = Color(theme.onSurfaceVariant);
  const black = Color('#000');
  const white = Color('#FFF');
  const contrastingColor =
    background.contrast(black) > background.contrast(white) ? black : white;
  const fillTint =
    background.contrast(themeIcon) >= minTileContrast
      ? themeIcon
      : contrastingColor;

  // Use the smallest color shift that still separates the tile from the library.
  let fill = background;
  for (
    let step = 1;
    step <= 20 && background.contrast(fill) < minTileContrast;
    step++
  ) {
    fill = Color(background.mix(fillTint, step / 20).hex());
  }

  const icon =
    fill.contrast(themeIcon) >= minIconContrast
      ? themeIcon
      : fill.contrast(black) > fill.contrast(white)
      ? black
      : white;
  const colors = { backgroundColor: fill.hex(), iconColor: icon.hex() };
  placeholderColorsByTheme.set(theme, colors);
  return colors;
};

const NovelCoverImage = ({
  iconSize = 32,
  onError,
  requestInit,
  style,
  theme,
  uri,
  accessibilityLabel,
  accessible,
  cachePolicy = 'memory-disk',
  contentFit = 'cover',
  onLayout,
  priority,
  recyclingKey,
  testID,
  transition = 150,
}: NovelCoverImageProps) => {
  const { reduceAppAnimations = false } = useAppSettings();
  const normalizedUri = uri?.trim();
  const [failedUri, setFailedUri] = useState<string>();
  const showPlaceholder =
    isMissingNovelCover(normalizedUri) || failedUri === normalizedUri;
  const requiresReactNativeImage =
    Boolean(requestInit?.body) ||
    Boolean(requestInit?.method && requestInit.method.toUpperCase() !== 'GET');

  if (showPlaceholder) {
    const { backgroundColor, iconColor } = getPlaceholderColors(theme);
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
        accessible={accessible}
        onLayout={onLayout}
        style={[styles.placeholder, { backgroundColor }, style]}
        testID={testID}
      >
        <MaterialCommunityIcons
          color={iconColor}
          name="book-open-page-variant-outline"
          size={iconSize}
        />
      </View>
    );
  }

  if (requiresReactNativeImage) {
    const source: ImageURISource = {
      body: requestInit?.body,
      headers: requestInit?.headers,
      method: requestInit?.method,
      uri: normalizedUri,
    };

    return (
      <ReactNativeImage
        accessibilityLabel={accessibilityLabel}
        accessible={accessible}
        onLayout={onLayout}
        onError={event => {
          setFailedUri(normalizedUri);
          onError?.({ error: event.nativeEvent.error });
        }}
        resizeMode={toReactNativeResizeMode(contentFit)}
        source={source}
        style={[{ backgroundColor: theme.surfaceVariant }, style]}
        testID={testID}
      />
    );
  }

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      accessible={accessible}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      onLayout={onLayout}
      onError={event => {
        setFailedUri(normalizedUri);
        onError?.(event);
      }}
      priority={priority}
      recyclingKey={recyclingKey ?? normalizedUri}
      source={{ headers: requestInit?.headers, uri: normalizedUri }}
      style={[{ backgroundColor: theme.surfaceVariant }, style]}
      testID={testID}
      transition={reduceAppAnimations ? 0 : transition}
    />
  );
};

const toReactNativeResizeMode = (
  contentFit: ImageContentFit,
): 'center' | 'contain' | 'cover' | 'stretch' =>
  contentFit === 'fill'
    ? 'stretch'
    : contentFit === 'none'
    ? 'center'
    : contentFit === 'scale-down'
    ? 'contain'
    : contentFit;

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default memo(NovelCoverImage);
