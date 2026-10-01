import { useState } from 'react';
import { Box, Column, LazyRow } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  width,
  background,
} from '@expo/ui/jetpack-compose/modifiers';

import type { NovelWithGenres } from '@database/queries/StatsQueries';
import { useTheme } from '@hooks/persisted/useTheme';
import { getString } from '@i18n/translations';
import { getPlugin } from '@plugins/pluginManager';
import { AppText, COVER_ASPECT } from '@components';
import { NovelCoverCard } from '@components/NovelCover';

const CARD_WIDTH = 96;
const MAX_VISIBLE = 10;

export type StatsNovel = Pick<
  NovelWithGenres,
  'id' | 'name' | 'path' | 'cover' | 'pluginId'
>;

const NovelCarousel = ({
  novels,
  onPress,
}: {
  novels: readonly StatsNovel[];
  onPress: (novel: StatsNovel) => void;
}) => {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);
  if (!novels.length) {
    return (
      <AppText
        variant="bodyMedium"
        color={theme.onSurfaceVariant}
        modifiers={[padding(16, 0, 16, 0)]}
      >
        {getString('genreStats.noNovels')}
      </AppText>
    );
  }
  const visible = showAll ? novels : novels.slice(0, MAX_VISIBLE);
  const coverHeight = Math.round(CARD_WIDTH * COVER_ASPECT);
  return (
    <Column modifiers={[fillMaxWidth()]}>
      <AppText
        variant="labelLarge"
        color={theme.onSurfaceVariant}
        modifiers={[padding(16, 0, 16, 8)]}
      >
        {getString('genreStats.novels')}
      </AppText>
      <LazyRow
        horizontalArrangement={{ spacedBy: 10 }}
        contentPadding={{ start: 16, end: 16 }}
        modifiers={[fillMaxWidth()]}
      >
        {visible.map(novel => (
          <Box key={novel.id} modifiers={[width(CARD_WIDTH)]}>
            <NovelCoverCard
              title={novel.name}
              coverUri={novel.cover}
              requestInit={getPlugin(novel.pluginId)?.imageRequestInit}
              width={CARD_WIDTH}
              onPress={() => onPress(novel)}
              theme={theme}
            />
          </Box>
        ))}
        {!showAll && novels.length > MAX_VISIBLE ? (
          <Column
            key="see-all"
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: 4 }}
            modifiers={[
              width(CARD_WIDTH),
              height(coverHeight),
              clip(Shapes.RoundedCorner(12)),
              background(theme.secondaryContainer),
              clickable(() => setShowAll(true)),
              padding(8, coverHeight / 2 - 12, 8, 0),
            ]}
          >
            <AppText
              variant="labelLarge"
              align="center"
              color={theme.onSecondaryContainer}
            >
              {`${getString('genreStats.seeAllNovels')} (${novels.length})`}
            </AppText>
          </Column>
        ) : null}
      </LazyRow>
    </Column>
  );
};

export default NovelCarousel;
