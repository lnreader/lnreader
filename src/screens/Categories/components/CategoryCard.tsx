import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';

import { Category } from '@database/types';
import { useTheme } from '@hooks/persisted';
import AddCategoryModal from './AddCategoryModal';
import { useBoolean } from '@hooks';
import { Badge, Portal } from 'react-native-paper';
import IconButton from '@components/IconButtonV2/IconButtonV2';
import DeleteCategoryModal from './DeleteCategoryModal';

interface CategoryCardProps {
  category: Category;
  getCategories: () => Promise<void>;
  drag: () => void;
  isActive: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  getCategories,
  drag,
  isActive,
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

  return (
    <>
      <View
        style={[
          styles.cardCtn,
          {
            backgroundColor: theme.secondaryContainer,
          },
          isActive && styles.activeCard,
        ]}
      >
        <View style={styles.buttonsCtn}>
          <TouchableOpacity
            onLongPress={drag}
            style={styles.dragHandle}
            activeOpacity={0.6}
          >
            <IconButton
              name="drag-horizontal-variant"
              color={theme.onSurface}
              theme={theme}
              padding={8}
            />
          </TouchableOpacity>
          <View style={styles.nameCtn}>
            <Text
              style={[
                styles.name,
                {
                  color: theme.onSurface,
                },
              ]}
              onPress={showCategoryModal}
              disabled={category.id === 2}
            >
              {category.name}
            </Text>
            {category.id === 2 && (
              <Badge
                style={[
                  styles.badge,
                  {
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                System
              </Badge>
            )}
          </View>
          <View style={styles.flex} />
          <View style={[category.id === 2 && styles.disabledOpacity]}>
            <IconButton
              name="pencil-outline"
              color={category.id === 2 ? theme.outline : theme.onSurface}
              style={styles.manageBtn}
              onPress={showCategoryModal}
              theme={theme}
              disabled={category.id === 2}
            />
          </View>
          <View style={[category.id === 2 && styles.disabledOpacity]}>
            <IconButton
              name="delete-outline"
              color={category.id === 2 ? theme.outline : theme.onSurface}
              style={styles.manageBtn}
              onPress={showDeleteCategoryModal}
              theme={theme}
              disabled={category.id === 2}
            />
          </View>
        </View>
      </View>
      <Portal>
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
      </Portal>
    </>
  );
};

export default CategoryCard;

const styles = StyleSheet.create({
  buttonsCtn: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  cardCtn: {
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dragHandle: {
    marginEnd: 4,
  },
  flex: {
    flex: 1,
  },
  manageBtn: {
    marginStart: 16,
  },
  name: {
    marginStart: 16,
    marginEnd: 8,
  },
  nameCtn: {
    alignItems: 'center',
    flexGrow: 1,
    flexDirection: 'row',
    marginStart: 8,
    paddingEnd: 16,
    paddingVertical: 4,
  },
  activeCard: {
    opacity: 0.8,
    elevation: 8,
  },
  badge: {
    paddingHorizontal: 8,
  },
  disabledOpacity: {
    opacity: 0.4,
  },
});
