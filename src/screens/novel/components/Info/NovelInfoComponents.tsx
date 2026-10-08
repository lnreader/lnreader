import React, { memo, useMemo, useState } from 'react';
import {
  BasicAlertDialog,
  Box,
  Column,
  Image,
  RNHostView,
  Row,
} from '@expo/ui/jetpack-compose';
import {
  alpha,
  background,
  clickable,
  clip,
  combinedClickable,
  fillMaxWidth,
  height,
  horizontalScroll,
  matchParentSize,
  onSizeChanged,
  padding,
  Shapes,
} from '@expo/ui/jetpack-compose/modifiers';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AppText, Chip, IconButtonV2, NovelCoverImage } from '@components';
import { ThemeColors } from '@theme/types';
import { useCoverSource } from '@utils/coverCache';
import { parseGenres } from '../../utils/genres';
import EditIcon from '@expo/material-symbols/edit.xml';
import SaveIcon from '@expo/material-symbols/save.xml';

/** A cover and the headers its source needs. */
export interface CoverSource {
  uri?: string;
  headers?: Record<string, string>;
}

interface CoverImageProps {
  children: React.ReactNode;
  source: CoverSource;
  theme: ThemeColors;
  hideBackdrop: boolean;
  /** Room for a top bar drawn over the backdrop. */
  topPadding?: number;
}

interface NovelThumbnailProps {
  source: CoverSource;
  theme: ThemeColors;
  setCustomNovelCover: () => void | Promise<void>;
  saveNovelCover: () => void | Promise<void>;
}

interface NovelTitleProps {
  theme: ThemeColors;
  children: React.ReactNode;
  onLongPress: () => void;
  onPress: () => void;
}

const THUMBNAIL_WIDTH = 116;
const THUMBNAIL_HEIGHT = 174;

const NovelInfoContainer = ({ children }: { children: React.ReactNode }) => (
  <Row
    horizontalArrangement={{ spacedBy: 16 }}
    modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}
  >
    {children}
  </Row>
);

// Compose has no gradient brush here, so the fade is drawn with SVG.
const BackdropFade = ({ color }: { color: string }) => {
  const [size, setSize] = useState<{ width: number; height: number }>();
  return (
    <Box modifiers={[matchParentSize(), onSizeChanged(setSize)]}>
      {size ? (
        <RNHostView matchContents>
          <View style={size}>
            <Svg width={size.width} height={size.height}>
              <Defs>
                <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity={0} />
                  <Stop offset="1" stopColor={color} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#fade)" />
            </Svg>
          </View>
        </RNHostView>
      ) : null}
    </Box>
  );
};

const CoverImage = memo(
  ({
    children,
    source,
    theme,
    hideBackdrop,
    topPadding = 0,
  }: CoverImageProps) => {
    const requestInit = useMemo(
      () => (source.headers ? { headers: source.headers } : undefined),
      [source.headers],
    );
    const cover = useCoverSource(source.uri, requestInit);
    const content = (
      <Column modifiers={[fillMaxWidth(), padding(0, topPadding, 0, 0)]}>
        {children}
      </Column>
    );

    if (hideBackdrop || cover.status !== 'ready') {
      return <Box modifiers={[fillMaxWidth()]}>{content}</Box>;
    }

    return (
      <Box modifiers={[fillMaxWidth()]}>
        <Image
          source={{ uri: cover.uri }}
          contentScale="crop"
          modifiers={[matchParentSize()]}
        />
        <Box
          modifiers={[
            matchParentSize(),
            alpha(0.7),
            background(theme.background),
          ]}
        />
        <BackdropFade color={theme.background} />
        {content}
      </Box>
    );
  },
);

const NovelThumbnail = ({
  source,
  theme,
  setCustomNovelCover,
  saveNovelCover,
}: NovelThumbnailProps) => {
  const [expanded, setExpanded] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const requestInit = useMemo(
    () => (source.headers ? { headers: source.headers } : undefined),
    [source.headers],
  );
  const cover = useCoverSource(source.uri, requestInit);

  return (
    <Box modifiers={[clickable(() => setExpanded(!expanded))]}>
      <NovelCoverImage
        uri={source.uri}
        requestInit={requestInit}
        width={THUMBNAIL_WIDTH}
        height={THUMBNAIL_HEIGHT}
        theme={theme}
      />
      {expanded ? (
        <BasicAlertDialog onDismissRequest={() => setExpanded(false)}>
          <Column horizontalAlignment="center">
            <Row horizontalArrangement="end" modifiers={[fillMaxWidth()]}>
              <IconButtonV2
                name={EditIcon}
                onPress={setCustomNovelCover}
                theme={theme}
              />
              <IconButtonV2
                name={SaveIcon}
                onPress={saveNovelCover}
                theme={theme}
              />
            </Row>
            {cover.status === 'ready' ? (
              <Box
                modifiers={[
                  clip(Shapes.RoundedCorner(20)),
                  clickable(() => setExpanded(false)),
                ]}
              >
                <Image
                  source={{ uri: cover.uri }}
                  contentScale="fit"
                  modifiers={[
                    fillMaxWidth(),
                    height(Math.round(windowHeight * 0.6)),
                  ]}
                />
              </Box>
            ) : null}
          </Column>
        </BasicAlertDialog>
      ) : null}
    </Box>
  );
};

const NovelTitle = ({
  theme,
  children,
  onLongPress,
  onPress,
}: NovelTitleProps) => (
  <AppText
    variant="titleLarge"
    weight="700"
    color={theme.onBackground}
    maxLines={4}
    modifiers={[
      combinedClickable({ onClick: onPress, onLongClick: onLongPress }),
    ]}
  >
    {children}
  </AppText>
);

const NovelInfo = ({
  theme,
  children,
}: {
  theme: ThemeColors;
  children: string;
}) => (
  <AppText variant="bodyMedium" color={theme.onSurfaceVariant} maxLines={1}>
    {/* Scraped metadata often carries stray newlines and spaces. */}
    {children.replace(/\s+/g, ' ').trim()}
  </AppText>
);

interface NovelGenresProps {
  theme: ThemeColors;
  genres?: string | null;
}

const NovelGenres = memo(({ theme, genres }: NovelGenresProps) => {
  const data = useMemo(() => parseGenres(genres), [genres]);

  return (
    <Row
      horizontalArrangement={{ spacedBy: 8 }}
      modifiers={[fillMaxWidth(), horizontalScroll(), padding(16, 4, 16, 8)]}
    >
      {data.map((item, index) => (
        <Chip key={'genre' + index} kind="assist" label={item} theme={theme} />
      ))}
    </Row>
  );
});

export {
  NovelInfoContainer,
  CoverImage,
  NovelThumbnail,
  NovelTitle,
  NovelInfo,
  NovelGenres,
};
