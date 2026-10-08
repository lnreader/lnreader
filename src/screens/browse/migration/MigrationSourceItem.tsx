import { Image, ListItem } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';

import { AppText, listItemColors } from '@components';
import { PluginItem } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import { getLocaleLanguageName } from '@utils/constants/languages';

interface MigrationSourceCardProps {
  item: PluginItem;
  theme: ThemeColors;
  noOfNovels: number;
  onPress: () => void;
  /** Highlighted while its novels show beside the list. */
  selected?: boolean;
}

const MigrationSourceCard = ({
  item,
  theme,
  noOfNovels,
  onPress,
  selected,
}: MigrationSourceCardProps) => {
  const { name, iconUrl, lang } = item;

  return (
    <ListItem
      colors={{
        ...listItemColors(theme),
        containerColor: selected ? theme.secondaryContainer : 'transparent',
      }}
      modifiers={[fillMaxWidth(), clickable(onPress)]}
    >
      <ListItem.LeadingContent>
        <Image
          source={{ uri: iconUrl }}
          contentScale="crop"
          modifiers={[size(40, 40), clip(Shapes.RoundedCorner(10))]}
        />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <AppText variant="bodyLarge" maxLines={1}>
          {name}
        </AppText>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <AppText
          variant="bodySmall"
          color={theme.onSurfaceVariant}
          maxLines={1}
        >
          {getLocaleLanguageName(lang)}
        </AppText>
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        <AppText variant="labelLarge" color={theme.onSurfaceVariant}>
          {String(noOfNovels || 0)}
        </AppText>
      </ListItem.TrailingContent>
    </ListItem>
  );
};

export default MigrationSourceCard;
