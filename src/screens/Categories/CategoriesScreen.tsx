import { StyleSheet } from 'react-native';
import React, { useEffect } from 'react';
import { FAB } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';

import { Appbar, EmptyView, SafeAreaView } from '@components/index';
import AddCategoryModal from './components/AddCategoryModal';

import { updateCategoryOrderInDb } from '@database/queries/CategoryQueries';
import { useBoolean } from '@hooks';
import { useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';

import CategoryCard from './components/CategoryCard';
import CategorySkeletonLoading from './components/CategorySkeletonLoading';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { ExtendedCategory } from '@screens/library/hooks/useLibrary';

const CategoriesScreen = () => {
  const { categories, setCategories, refreshCategories, isLoading } =
    useLibraryContext();
  const theme = useTheme();
  const { goBack } = useNavigation();

  const { bottom, right } = useSafeAreaInsets();

  const {
    value: categoryModalVisible,
    setTrue: showCategoryModal,
    setFalse: closeCategoryModal,
  } = useBoolean();

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  const userCategories = React.useMemo(() => {
    if (!categories || categories.length === 0) {
      return [];
    }

    return categories;
  }, [categories]);

  const onDragEnd = ({ data }: { data: ExtendedCategory[] }) => {
    if (!categories || categories.length === 0) {
      return;
    }

    const updatedOrderCategories = data.map((category, index) => ({
      ...category,
      sort: index,
    }));

    setCategories(updatedOrderCategories);
    updateCategoryOrderInDb(updatedOrderCategories);
  };

  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<ExtendedCategory>) => (
    <CategoryCard
      category={item}
      getCategories={refreshCategories}
      drag={drag}
      isActive={isActive}
    />
  );

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('categories.header')}
        handleGoBack={goBack}
        theme={theme}
      />
      {isLoading ? (
        <CategorySkeletonLoading width={360.7} height={89.5} theme={theme} />
      ) : (
        <DraggableFlatList
          data={userCategories}
          contentContainerStyle={styles.contentCtn}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          onDragEnd={onDragEnd}
          activationDistance={10}
          autoscrollSpeed={100}
          ListEmptyComponent={
            <EmptyView
              icon="Σ(ಠ_ಠ)"
              description={getString('categories.emptyMsg')}
              theme={theme}
            />
          }
        />
      )}
      <FAB
        style={[styles.fab, { backgroundColor: theme.primary, right, bottom }]}
        color={theme.onPrimary}
        label={getString('common.add')}
        uppercase={false}
        onPress={showCategoryModal}
        icon={'plus'}
      />

      <AddCategoryModal
        visible={categoryModalVisible}
        closeModal={closeCategoryModal}
        onSuccess={refreshCategories}
      />
    </SafeAreaView>
  );
};

export default CategoriesScreen;

const styles = StyleSheet.create({
  contentCtn: {
    flexGrow: 1,
    paddingBottom: 270,
    paddingVertical: 16,
  },
  fab: {
    bottom: 16,
    margin: 16,
    position: 'absolute',
    right: 0,
  },
});
