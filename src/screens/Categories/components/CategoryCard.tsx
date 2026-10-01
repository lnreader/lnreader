import React from 'react';
import { Box, Row } from '@expo/ui/jetpack-compose';
import {
  alpha,
  animated,
  background,
  clickable,
  clip,
  fillMaxWidth,
  graphicsLayer,
  height,
  padding,
  Shapes,
  tween,
  weight,
  zIndex,
} from '@expo/ui/jetpack-compose/modifiers';

import { Category } from '@database/types';
import { useTheme } from '@hooks/persisted';
import AddCategoryModal from './AddCategoryModal';
import { useBoolean } from '@hooks';
import { AppText } from '@components';
import IconButton from '@components/IconButtonV2/IconButtonV2';
import DeleteCategoryModal from './DeleteCategoryModal';
import DeleteIcon from '@expo/material-symbols/delete.xml';
import DragHandleIcon from '@expo/material-symbols/drag_handle.xml';
import EditIcon from '@expo/material-symbols/edit.xml';

export const CARD_HEIGHT = 64;
export const CARD_GAP = 8;
export const DRAG_HANDLE_WIDTH = 56;

interface CategoryCardProps {
  category: Category;
  getCategories: () => Promise<void>;
  /** Vertical shift in dp: under the finger while dragged, a slot otherwise. */
  shift: number;
  dragged: boolean;
  /** Slide to `shift` rather than jump there. */
  animate: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  getCategories,
  shift,
  dragged,
  animate,
}) => {
  const theme = useTheme();

  const {
    value: categoryModalVisible,
    setTrue: showCategoryModal,
    setFalse: closeCategoryModal,
  } = useBoolean();

  const {
    value: deletecategoryModalVisible,
    setTrue: showDeleteCategoryModal,
    setFalse: closeDeleteCategoryModal,
  } = useBoolean();

  const opacity = category.id <= 2 ? 0.4 : 1;

  return (
    <Box
      modifiers={[
        fillMaxWidth(),
        padding(0, 0, 0, CARD_GAP),
        zIndex(dragged ? 1 : 0),
        graphicsLayer({
          translationY: animate
            ? animated(shift, tween({ durationMillis: 150 }))
            : shift,
        }),
      ]}
    >
      <Row
        verticalAlignment="center"
        modifiers={[
          fillMaxWidth(),
          height(CARD_HEIGHT),
          graphicsLayer({
            shadowElevation: dragged ? 8 : 0,
            shape: Shapes.RoundedCorner(12),
          }),
          clip(Shapes.RoundedCorner(12)),
          background(theme.secondaryContainer),
          padding(8, 8, 8, 8),
        ]}
      >
        {/* Dragged from a React Native view over it (see the screen). */}
        <IconButton
          name={DragHandleIcon}
          color={theme.onSurface}
          onPress={() => undefined}
          theme={theme}
        />
        <Box modifiers={[weight(1), padding(8, 4, 16, 4)]}>
          <AppText
            color={theme.onSurface}
            maxLines={1}
            modifiers={
              category.id <= 2 ? undefined : [clickable(showCategoryModal)]
            }
          >
            {category.name}
          </AppText>
        </Box>
        {category.id <= 2 && (
          <AppText
            variant="labelSmall"
            color={theme.onTertiaryContainer}
            modifiers={[
              clip(Shapes.Circle),
              background(theme.tertiaryContainer),
              padding(8, 2, 8, 2),
            ]}
          >
            System
          </AppText>
        )}

        <Box modifiers={[padding(16, 0, 0, 0), alpha(opacity)]}>
          <IconButton
            name={EditIcon}
            color={category.id <= 2 ? theme.outline : theme.onSurface}
            onPress={showCategoryModal}
            disabled={category.id <= 2}
            theme={theme}
          />
        </Box>

        <Box modifiers={[padding(16, 0, 0, 0), alpha(opacity)]}>
          <IconButton
            name={DeleteIcon}
            color={category.id <= 2 ? theme.outline : theme.onSurface}
            onPress={showDeleteCategoryModal}
            disabled={category.id <= 2}
            theme={theme}
          />
        </Box>
      </Row>
      <AddCategoryModal
        isEditMode
        category={category}
        visible={categoryModalVisible}
        closeModal={closeCategoryModal}
        onSuccess={getCategories}
      />
      <DeleteCategoryModal
        category={category}
        visible={deletecategoryModalVisible}
        closeModal={closeDeleteCategoryModal}
        onSuccess={getCategories}
      />
    </Box>
  );
};

export default CategoryCard;
