import { Column, ListItem, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxHeight,
  fillMaxWidth,
  padding,
  Shapes,
  verticalScroll,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { AppText, IconButtonV2, listItemColors } from '@components';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import EditIcon from '@expo/material-symbols/edit.xml';

export const CATEGORY_PANE_WIDTH = 280;

type LibraryCategory = ReturnType<
  typeof useLibraryContext
>['categories'][number];

const CategoryPane = ({
  categories,
  selectedIndex,
  onSelect,
  showCounts,
  onEdit,
}: {
  categories: readonly LibraryCategory[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  showCounts: boolean;
  onEdit: () => void;
}) => {
  const theme = useTheme();
  return (
    <Column
      modifiers={[
        width(CATEGORY_PANE_WIDTH),
        fillMaxHeight(),
        verticalScroll(),
        padding(12, 0, 12, 16),
      ]}
    >
      <Row
        verticalAlignment="center"
        modifiers={[fillMaxWidth(), padding(16, 0, 4, 4)]}
      >
        <AppText
          variant="titleSmall"
          color={theme.onSurfaceVariant}
          modifiers={[weight(1)]}
        >
          {getString('common.categories')}
        </AppText>
        <IconButtonV2
          name={EditIcon}
          accessibilityLabel={getString('categories.header')}
          onPress={onEdit}
          theme={theme}
        />
      </Row>
      {categories.map((category, index) => {
        const selected = index === selectedIndex;
        return (
          <ListItem
            key={category.id}
            colors={{
              ...listItemColors(theme),
              containerColor: selected
                ? theme.secondaryContainer
                : 'transparent',
              contentColor: selected
                ? theme.onSecondaryContainer
                : theme.onSurface,
            }}
            modifiers={[
              fillMaxWidth(),
              clip(Shapes.RoundedCorner(28)),
              clickable(() => onSelect(index)),
            ]}
          >
            <ListItem.HeadlineContent>
              <AppText variant="labelLarge" maxLines={1}>
                {category.name}
              </AppText>
            </ListItem.HeadlineContent>
            {showCounts ? (
              <ListItem.TrailingContent>
                <AppText variant="labelLarge">
                  {String(category.novelIds.filter(id => id !== 0).length)}
                </AppText>
              </ListItem.TrailingContent>
            ) : null}
          </ListItem>
        );
      })}
    </Column>
  );
};

export default CategoryPane;
