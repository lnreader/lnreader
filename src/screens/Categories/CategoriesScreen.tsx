import { StyleSheet, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Gesture,
  GestureDetector,
  ScrollView,
} from 'react-native-gesture-handler';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { AppHost, Appbar, EmptyView, Fab, Screen } from '@components/index';
import AddCategoryModal from './components/AddCategoryModal';

import { updateCategoryOrderInDb } from '@database/queries/CategoryQueries';
import { useBoolean } from '@hooks';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

import CategoryCard, {
  CARD_GAP,
  CARD_HEIGHT,
  DRAG_HANDLE_WIDTH,
} from './components/CategoryCard';
import CategorySkeletonLoading from './components/CategorySkeletonLoading';
import { useLibraryContext } from '@components/Context/LibraryContext';
import AddIcon from '@expo/material-symbols/add.xml';

const CategoriesScreen = () => {
  const { categories, setCategories, refreshCategories, isLoading } =
    useLibraryContext();
  const theme = useTheme();
  const { goBack } = useNavigation();

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

  // A hand-rolled drag list instead of react-native-draggable-flatlist: that
  // list gives each row its own Compose host, and reordering moves those hosts
  // in the native view tree. A moved host redraws from blank for a frame, so
  // every drop flashed. Here every card shares one host; a drag only shifts
  // cards with a graphics layer, and the drop reorders them inside that host,
  // so no native view moves. The cards also keep one order (by id) and sit at
  // their slots by translation: reordering Compose children reloads their
  // icons, which flashed the buttons. The few categories need no virtualising.
  const stable = React.useMemo(
    () => [...userCategories].sort((a, b) => a.id - b.id),
    [userCategories],
  );
  const [drag, setDrag] = useState<{ from: number; dy: number }>();
  const target = drag
    ? Math.min(
        userCategories.length - 1,
        Math.max(0, drag.from + Math.round(drag.dy / ROW)),
      )
    : undefined;

  const shiftOf = (index: number) => {
    if (!drag || target === undefined) {
      return 0;
    }
    if (index === drag.from) {
      return drag.dy;
    }
    if (drag.from < target && index > drag.from && index <= target) {
      return -ROW;
    }
    if (drag.from > target && index < drag.from && index >= target) {
      return ROW;
    }
    return 0;
  };

  const drop = () => {
    if (!drag || target === undefined) {
      return;
    }
    setDrag(undefined);
    if (target === drag.from) {
      return;
    }
    const data = [...userCategories];
    const [moved] = data.splice(drag.from, 1);
    data.splice(target, 0, moved);
    setCategories(data);
    updateCategoryOrderInDb(data);
  };

  const handle = (index: number) =>
    Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onStart(() => setDrag({ from: index, dy: 0 }))
      .onUpdate(event => setDrag({ from: index, dy: event.translationY }))
      .onEnd(drop)
      .onFinalize(() => setDrag(undefined));

  return (
    <Screen
      topBar={
        <Appbar
          title={getString('categories.header')}
          handleGoBack={goBack}
          theme={theme}
        />
      }
      list={
        isLoading ? undefined : userCategories.length === 0 ? (
          <AppHost style={styles.empty}>
            <EmptyView
              icon="Σ(ಠ_ಠ)"
              description={getString('categories.emptyMsg')}
              theme={theme}
            />
          </AppHost>
        ) : (
          <ScrollView
            scrollEnabled={!drag}
            contentContainerStyle={styles.contentCtn}
          >
            <View style={{ height: userCategories.length * ROW }}>
              <AppHost style={StyleSheet.absoluteFill}>
                <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}>
                  {stable.map((category, order) => {
                    const slot = userCategories.indexOf(category);
                    return (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        getCategories={refreshCategories}
                        shift={(slot - order) * ROW + shiftOf(slot)}
                        dragged={drag?.from === slot}
                        animate={!!drag && drag.from !== slot}
                      />
                    );
                  })}
                </Column>
              </AppHost>
              {/* Compose has no drag gestures: these sit over the handles. */}
              {userCategories.map((category, index) => (
                <GestureDetector key={category.id} gesture={handle(index)}>
                  <View style={[styles.dragHandle, { top: index * ROW }]} />
                </GestureDetector>
              ))}
            </View>
          </ScrollView>
        )
      }
      floatingAction={
        <Fab
          extended
          label={getString('common.add')}
          onPress={showCategoryModal}
          icon={AddIcon}
        />
      }
      overlays={
        <AddCategoryModal
          visible={categoryModalVisible}
          closeModal={closeCategoryModal}
          onSuccess={refreshCategories}
        />
      }
    >
      {isLoading ? (
        <CategorySkeletonLoading width={360.7} height={89.5} theme={theme} />
      ) : null}
    </Screen>
  );
};

export default CategoriesScreen;

const ROW = CARD_HEIGHT + CARD_GAP;

const styles = StyleSheet.create({
  contentCtn: {
    flexGrow: 1,
    paddingBottom: 270,
    paddingVertical: 16,
  },
  empty: {
    flex: 1,
  },
  dragHandle: {
    position: 'absolute',
    left: 16,
    width: DRAG_HANDLE_WIDTH,
    height: CARD_HEIGHT,
  },
});
