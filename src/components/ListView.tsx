import { memo } from 'react';
import { Box, ListItem, Row, Surface } from '@expo/ui/jetpack-compose';
import {
  alpha,
  background,
  clip,
  combinedClickable,
  fillMaxSize,
  fillMaxWidth,
  Shapes,
} from '@expo/ui/jetpack-compose/modifiers';

import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import type { NovelInfo } from '@database/types';
import type { ImageRequestInit, NovelItem } from '@plugins/types';
import CheckIcon from '@expo/material-symbols/check.xml';
import PlayArrowIcon from '@expo/material-symbols/play_arrow.xml';
import AppIcon from './AppIcon/AppIcon';
import AppText from './AppText/AppText';
import IconButtonV2 from './IconButtonV2/IconButtonV2';
import { listItemColors } from './List/listItemColors';
import NovelCoverImage from './NovelCoverImage';
import { CoverBadgeRow, type CoverBadges } from './NovelCoverBadges';

interface ListViewProps {
  item: NovelItem | NovelInfo;
  requestInit?: ImageRequestInit;
  badges?: CoverBadges;
  onPress: () => void;
  isSelected?: boolean;
  onLongPress?: () => void;
  onContinueReading?: () => void;
  theme: ThemeColors;
}

const ListView = ({
  item,
  requestInit,
  badges,
  onPress,
  isSelected,
  onLongPress,
  onContinueReading,
  theme,
}: ListViewProps) => {
  const author = 'author' in item ? item.author : undefined;
  return (
    <ListItem
      colors={{
        ...listItemColors(theme),
        containerColor: isSelected ? theme.secondaryContainer : 'transparent',
      }}
      modifiers={[
        fillMaxWidth(),
        combinedClickable({ onClick: onPress, onLongClick: onLongPress }),
      ]}
    >
      <ListItem.LeadingContent>
        <Box>
          <NovelCoverImage
            uri={item.cover}
            requestInit={requestInit}
            width={44}
            height={64}
            corner={8}
            label={item.name}
            dimmed={badges?.inLibrary}
            theme={theme}
          />
          {isSelected ? (
            <Box
              contentAlignment="center"
              modifiers={[
                fillMaxSize(),
                clip(Shapes.RoundedCorner(8)),
                background(theme.primary),
                alpha(0.85),
              ]}
            >
              <AppIcon source={CheckIcon} tint={theme.onPrimary} />
            </Box>
          ) : null}
        </Box>
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <AppText variant="bodyLarge" maxLines={2}>
          {item.name}
        </AppText>
      </ListItem.HeadlineContent>
      {author ? (
        <ListItem.SupportingContent>
          <AppText
            variant="bodyMedium"
            color={theme.onSurfaceVariant}
            maxLines={1}
          >
            {author}
          </AppText>
        </ListItem.SupportingContent>
      ) : null}
      <ListItem.TrailingContent>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
          <CoverBadgeRow badges={badges} />
          {onContinueReading ? (
            <Surface color="transparent">
              <IconButtonV2
                name={PlayArrowIcon}
                accessibilityLabel={getString('novelScreen.continueReading')}
                variant="tonal"
                onPress={onContinueReading}
                theme={theme}
              />
            </Surface>
          ) : null}
        </Row>
      </ListItem.TrailingContent>
    </ListItem>
  );
};

export default memo(ListView);
