import React from 'react';
import { Image, ListItem } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import { getString } from '@i18n/translations';
import { AppText, Button, listItemColors } from '@components';

import { ThemeColors } from '@theme/types';

interface Props {
  trackerName: string;
  /** A `require`d image. */
  icon: number;
  onPress: () => void;
  theme: ThemeColors;
}

const DiscoverCard: React.FC<Props> = ({
  theme,
  icon,
  trackerName,
  onPress,
}) => {
  return (
    <ListItem
      colors={listItemColors(theme)}
      modifiers={[fillMaxWidth(), clickable(onPress)]}
    >
      <ListItem.LeadingContent>
        <Image
          source={icon}
          modifiers={[size(40, 40), clip(Shapes.RoundedCorner(10))]}
        />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <AppText variant="bodyLarge" maxLines={1}>
          {trackerName}
        </AppText>
      </ListItem.HeadlineContent>
      <ListItem.TrailingContent>
        <Button mode="text" title={getString('browse')} onPress={onPress} />
      </ListItem.TrailingContent>
    </ListItem>
  );
};

export default DiscoverCard;
