import { memo, useState } from 'react';
import { Box, Image } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxWidth,
  height,
  Shapes,
  size,
  testID as testIDModifier,
} from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import { type ImageRequestInit } from '@plugins/types';
import AutoStoriesIcon from '@expo/material-symbols/auto_stories.xml';
import AppIcon from './AppIcon/AppIcon';
import { useCoverSource } from '../utils/coverCache';

export { isMissingNovelCover } from '../utils/coverCache';

export const COVER_ASPECT = 1.5;

/** Dark in every theme, for legibility over covers. */
export const COVER_SCRIM = '#000000A6';

export const CORNER = 12;

interface NovelCoverImageProps {
  uri?: string | null;
  requestInit?: ImageRequestInit;
  width?: number;
  height: number;
  corner?: number;
  label?: string;
  dimmed?: boolean;
  theme: ThemeColors;
  testID?: string;
}

const NovelCoverImage = memo(function CoverImageView({
  uri,
  requestInit,
  width,
  height: coverHeight,
  corner = CORNER,
  label,
  dimmed,
  theme,
  testID,
}: NovelCoverImageProps) {
  const source = useCoverSource(uri, requestInit);
  const [failedUri, setFailedUri] = useState<string>();
  const frame = [
    width === undefined ? fillMaxWidth() : size(width, coverHeight),
    height(coverHeight),
    clip(Shapes.RoundedCorner(corner)),
    background(theme.surfaceContainerHighest ?? theme.surfaceVariant),
    ...(testID ? [testIDModifier(testID)] : []),
  ];

  if (source.status !== 'ready' || failedUri === source.uri) {
    return (
      <Box contentAlignment="center" modifiers={frame}>
        <AppIcon
          source={AutoStoriesIcon}
          size={32}
          tint={theme.outline}
          label={label}
        />
      </Box>
    );
  }
  return (
    <Image
      source={{ uri: source.uri }}
      contentScale="crop"
      contentDescription={label}
      alpha={dimmed ? 0.5 : 1}
      onError={() => setFailedUri(source.uri)}
      modifiers={frame}
    />
  );
});

export default NovelCoverImage;
