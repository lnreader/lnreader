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

import { defaultCover } from '@plugins/helpers/constants';
import type { ImageRequestInit } from '@plugins/types';
import type { ThemeColors } from '@theme/types';

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
  const normalizedUri = uri?.trim();
  const [failedUri, setFailedUri] = useState<string>();
  const showPlaceholder =
    isMissingNovelCover(normalizedUri) || failedUri === normalizedUri;
  const requiresReactNativeImage =
    Boolean(requestInit?.body) ||
    Boolean(requestInit?.method && requestInit.method.toUpperCase() !== 'GET');

  if (showPlaceholder) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
        accessible={accessible}
        onLayout={onLayout}
        style={[
          styles.placeholder,
          { backgroundColor: theme.surfaceVariant },
          style,
        ]}
        testID={testID}
      >
        <MaterialCommunityIcons
          color={theme.onSurfaceVariant}
          name="book-open-page-variant-outline"
          size={iconSize}
          style={styles.icon}
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
      transition={transition}
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
  icon: {
    opacity: 0.45,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default memo(NovelCoverImage);
