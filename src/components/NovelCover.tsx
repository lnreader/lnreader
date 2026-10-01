import { memo } from 'react';
import { Box, Column } from '@expo/ui/jetpack-compose';
import {
  align,
  background,
  clip,
  combinedClickable,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import type { ImageRequestInit, NovelItem } from '@plugins/types';
import type { DBNovelInfo, NovelInfo } from '@database/types';
import { DisplayModes } from '@screens/library/constants/constants';
import CheckIcon from '@expo/material-symbols/check.xml';
import PlayArrowIcon from '@expo/material-symbols/play_arrow.xml';
import AppIcon from './AppIcon/AppIcon';
import OutlinedBox from './OutlinedBox/OutlinedBox';
import AppText from './AppText/AppText';
import IconButtonV2 from './IconButtonV2/IconButtonV2';
import ListView from './ListView';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { CoverBadgeRow, type CoverBadges } from './NovelCoverBadges';
import { useNovelCoverLayout } from './NovelCoverLayoutContext';
import NovelCoverImage, {
  COVER_ASPECT,
  COVER_SCRIM,
  CORNER,
} from './NovelCoverImage';

export type CoverCardVariant = 'compact' | 'comfortable' | 'coverOnly';

export interface NovelItemProps {
  title: string;
  coverUri?: string | null;
  requestInit?: ImageRequestInit;
  badges?: CoverBadges;
  selected?: boolean;
  onContinue?: () => void;
  onPress: () => void;
  onLongPress?: () => void;
  theme: ThemeColors;
}

export interface NovelCoverCardProps extends NovelItemProps {
  width: number;
  variant?: CoverCardVariant;
}

export const NovelCoverCard = memo(function NovelCoverCardView({
  title,
  coverUri,
  requestInit,
  width: cardWidth,
  variant = 'comfortable',
  badges,
  selected,
  onContinue,
  onPress,
  onLongPress,
  theme,
}: NovelCoverCardProps) {
  const coverHeight = Math.round(cardWidth * COVER_ASPECT);

  // Same tree selected or not, so toggling selection does not reload covers.
  return (
    <OutlinedBox
      shape={CORNER + 2}
      outlineWidth={selected ? 2 : 0}
      outlineColor={selected ? theme.primary : 'transparent'}
      color={selected ? theme.secondaryContainer : undefined}
      modifiers={[fillMaxWidth()]}
    >
      <Column
        verticalArrangement={{ spacedBy: 6 }}
        modifiers={[
          fillMaxWidth(),
          combinedClickable({ onClick: onPress, onLongClick: onLongPress }),
          padding(selected ? 2 : 0, selected ? 2 : 0, selected ? 2 : 0, 4),
        ]}
      >
        <Box modifiers={[fillMaxWidth(), height(coverHeight)]}>
          <NovelCoverImage
            uri={coverUri}
            requestInit={requestInit}
            height={coverHeight}
            label={title}
            dimmed={badges?.inLibrary}
            theme={theme}
          />
          <Box modifiers={[align('topStart'), padding(6, 6, 6, 6)]}>
            <CoverBadgeRow badges={badges} />
          </Box>
          {selected ? (
            <Box modifiers={[align('topEnd'), padding(6, 6, 6, 6)]}>
              <Box
                contentAlignment="center"
                modifiers={[
                  size(28, 28),
                  clip(Shapes.Circle),
                  background(theme.primary),
                ]}
              >
                <AppIcon source={CheckIcon} size={18} tint={theme.onPrimary} />
              </Box>
            </Box>
          ) : null}
          {variant === 'compact' ? (
            <Box
              modifiers={[
                align('bottomStart'),
                fillMaxWidth(),
                clip(
                  Shapes.RoundedCorner({
                    bottomStart: CORNER,
                    bottomEnd: CORNER,
                  }),
                ),
                background(COVER_SCRIM),
                padding(8, 6, onContinue ? 44 : 8, 8),
              ]}
            >
              <AppText
                variant="labelLarge"
                weight="600"
                color="#FFFFFF"
                maxLines={2}
              >
                {title}
              </AppText>
            </Box>
          ) : null}
          {onContinue ? (
            <Box modifiers={[align('bottomEnd'), padding(4, 4, 4, 4)]}>
              <IconButtonV2
                name={PlayArrowIcon}
                accessibilityLabel={getString('novelScreen.continueReading')}
                variant="filled"
                size={20}
                onPress={onContinue}
                theme={theme}
              />
            </Box>
          ) : null}
        </Box>
        {variant === 'comfortable' ? (
          <AppText
            variant="labelLarge"
            color={theme.onSurface}
            maxLines={2}
            modifiers={[padding(4, 0, 4, 0)]}
          >
            {title}
          </AppText>
        ) : null}
      </Column>
    </OutlinedBox>
  );
});

type CoverItem = (NovelInfo | NovelItem) &
  Partial<Pick<DBNovelInfo, 'chaptersDownloaded' | 'chaptersUnread'>> & {
    completeRow?: number;
  };

interface INovelCover<TNovel extends CoverItem> {
  item: TNovel;
  onPress: () => void;
  libraryStatus: boolean;
  theme: ThemeColors;
  isSelected: boolean;
  addSkeletonLoading?: boolean;
  inActivity?: boolean;
  onLongPress: (item: TNovel) => void;
  hasSelection?: boolean;
  globalSearch?: boolean;
  imageRequestInit?: ImageRequestInit;
  onContinueReading?: () => void;
}

function NovelCover<TNovel extends CoverItem>({
  item,
  onPress,
  libraryStatus,
  theme,
  isSelected,
  addSkeletonLoading,
  inActivity,
  onLongPress,
  hasSelection,
  globalSearch,
  imageRequestInit,
  onContinueReading,
}: INovelCover<TNovel>) {
  const { coverWidth, displayMode, showDownloadBadges, showUnreadBadges } =
    useNovelCoverLayout();

  const selectNovel = () => onLongPress(item);
  const badges: CoverBadges = {
    inLibrary: libraryStatus,
    downloaded: showDownloadBadges ? item.chaptersDownloaded : null,
    unread: showUnreadBadges ? item.chaptersUnread : null,
    busy: inActivity,
  };
  const continueReading = hasSelection ? undefined : onContinueReading;

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

  return displayMode !== DisplayModes.List || globalSearch ? (
    <NovelCoverCard
      title={item.name}
      coverUri={item.cover}
      requestInit={imageRequestInit}
      width={coverWidth}
      variant={
        displayMode === DisplayModes.Compact
          ? 'compact'
          : displayMode === DisplayModes.CoverOnly
          ? 'coverOnly'
          : 'comfortable'
      }
      badges={badges}
      selected={isSelected}
      onPress={hasSelection ? selectNovel : onPress}
      onLongPress={selectNovel}
      onContinue={continueReading}
      theme={theme}
    />
  ) : (
    <ListView
      item={item}
      requestInit={imageRequestInit}
      badges={badges}
      isSelected={isSelected}
      onPress={hasSelection ? selectNovel : onPress}
      onLongPress={selectNovel}
      onContinueReading={continueReading}
      theme={theme}
    />
  );
}

export default memo(NovelCover) as typeof NovelCover;
