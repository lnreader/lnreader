import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  NavigationState,
  SceneRendererProps,
  TabBar,
  TabView,
} from 'react-native-tab-view';
import Color from 'color';

import { SearchbarV2, Button, SafeAreaView } from '@components/index';
import { LibraryView } from './components/LibraryListView';
import LibraryBottomSheet from './components/LibraryBottomSheet/LibraryBottomSheet';
import { Banner } from './components/Banner';
import { Actionbar } from '@components/Actionbar/Actionbar';

import { useAppSettings, useHistory, useTheme } from '@hooks/persisted';
import { useSearch, useBackHandler, useBoolean } from '@hooks';
import { getString } from '@i18n/translations';
import { FAB, Portal } from 'react-native-paper';
import {
  markAllChaptersRead,
  markAllChaptersUnread,
} from '@database/queries/ChapterQueries';
import { removeNovelsFromLibrary } from '@database/queries/NovelQueries';
import SetCategoryModal from '@screens/novel/components/SetCategoriesModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { Row } from '@components/Common';
import { LibraryScreenProps } from '@navigators/types';
import { NovelInfo } from '@database/types';
import * as DocumentPicker from 'expo-document-picker';
import { backgroundTasks } from '@services/backgroundTasks';
import useImport from '@hooks/persisted/useImport';
import { ThemeColors } from '@theme/types';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { xor } from 'lodash-es';
import { SelectionContext } from './SelectionContext';

type State = NavigationState<{
  key: string;
  title: string;
}>;

type TabViewLabelProps = {
  route: {
    id: number;
    name: string;
    sort: number;
    novelIds: number[];
    key: string;
    title: string;
  };
  labelText?: string;
  focused: boolean;
  color: string;
  allowFontScaling?: boolean;
  style?: StyleProp<TextStyle>;
};

const LibraryScreen = ({ navigation }: LibraryScreenProps) => {
  const { searchText, setSearchText, clearSearchbar } = useSearch();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { left: leftInset, right: rightInset } = useSafeAreaInsets();
  const {
    library,
    categories,
    refetchLibrary,
    isLoading,
    settings: { showNumberOfNovels, downloadedOnlyMode, incognitoMode },
  } = useLibraryContext();

  const { importNovel } = useImport();
  const { useLibraryFAB = false } = useAppSettings();

  const { isLoading: isHistoryLoading, history, error } = useHistory();

  const layout = useWindowDimensions();

  const bottomSheetRef = useRef<BottomSheetModal | null>(null);

  const [index, setIndex] = useState(0);

  const {
    value: setCategoryModalVisible,
    setTrue: showSetCategoryModal,
    setFalse: closeSetCategoryModal,
  } = useBoolean();

  const [selectedNovelIds, setSelectedNovelIds] = useState<number[]>([]);

  const selectedIdsSet = useMemo(
    () => new Set(selectedNovelIds),
    [selectedNovelIds],
  );
  const hasSelection = selectedNovelIds.length > 0;

  const toggleSelection = useCallback(
    (id: number) => setSelectedNovelIds(prev => xor(prev, [id])),
    [],
  );

  const selectionContextValue = useMemo(
    () => ({
      selectedIdsSet,
      hasSelection,
      toggleSelection,
      setSelectedNovelIds,
    }),
    [selectedIdsSet, hasSelection, toggleSelection],
  );

  const currentNovels = useMemo(() => {
    if (!categories.length) return [];
    const idsSet = new Set(categories[index].novelIds);
    return library.filter(l => idsSet.has(l.id));
  }, [categories, index, library]);

  useBackHandler(() => {
    if (selectedNovelIds.length) {
      setSelectedNovelIds([]);
      return true;
    }

    return false;
  });

  useEffect(
    () =>
      navigation.addListener('tabPress', e => {
        if (navigation.isFocused()) {
          e.preventDefault();

          bottomSheetRef.current?.present?.();
        }
      }),
    [navigation],
  );

  const searchbarPlaceholder =
    selectedNovelIds.length === 0
      ? getString('libraryScreen.searchbar')
      : `${selectedNovelIds.length} selected`;

  const openRandom = useCallback(() => {
    const randomNovel =
      currentNovels[Math.floor(Math.random() * currentNovels.length)];
    if (randomNovel) {
      navigation.navigate('ReaderStack', {
        screen: 'Novel',
        params: randomNovel,
      });
    }
  }, [currentNovels, navigation]);

  const pickAndImport = useCallback(() => {
    DocumentPicker.getDocumentAsync({
      type: 'application/epub+zip',
      copyToCacheDirectory: false,
      multiple: true,
    }).then(importNovel);
  }, [importNovel]);

  const searchLower = useMemo(() => searchText.toLowerCase(), [searchText]);

  const tabBarBorderColor = useMemo(
    () =>
      Color(theme.isDark ? '#FFFFFF' : '#000000')
        .alpha(0.12)
        .string(),
    [theme.isDark],
  );

  const renderTabBar = useCallback(
    (props: SceneRendererProps & { navigationState: State }) => {
      return categories.length ? (
        <TabBar
          {...props}
          scrollEnabled
          indicatorStyle={styles.tabBarIndicator}
          style={[
            {
              backgroundColor: theme.surface,
              borderBottomColor: tabBarBorderColor,
            },
            styles.tabBar,
          ]}
          tabStyle={styles.tabStyle}
          gap={8}
          inactiveColor={theme.secondary}
          activeColor={theme.primary}
          android_ripple={{ color: theme.rippleColor }}
        />
      ) : null;
    },
    [
      categories.length,
      styles.tabBar,
      styles.tabBarIndicator,
      styles.tabStyle,
      tabBarBorderColor,
      theme.primary,
      theme.rippleColor,
      theme.secondary,
      theme.surface,
    ],
  );
  const renderScene = useCallback(
    ({
      route,
    }: {
      route: {
        id: number;
        name: string;
        sort: number;
        novelIds: number[];
        key: string;
        title: string;
      };
    }) => {
      const idsSet = new Set(route.novelIds);
      const unfilteredNovels = library.filter(l => idsSet.has(l.id));

      const novels = searchLower
        ? unfilteredNovels.filter(
            n =>
              n.name.toLowerCase().includes(searchLower) ||
              (n.author?.toLowerCase().includes(searchLower) ?? false),
          )
        : unfilteredNovels;

      return isLoading ? (
        <SourceScreenSkeletonLoading theme={theme} />
      ) : (
        <>
          {searchText ? (
            <Button
              title={`${getString(
                'common.searchFor',
              )} "${searchText}" ${getString('common.globally')}`}
              style={styles.globalSearchBtn}
              onPress={() =>
                navigation.navigate('GlobalSearchScreen', {
                  searchText,
                })
              }
            />
          ) : null}
          <LibraryView
            categoryId={route.id}
            categoryName={route.name}
            novels={novels}
            pickAndImport={pickAndImport}
            navigation={navigation}
          />
        </>
      );
    },
    [
      isLoading,
      library,
      navigation,
      pickAndImport,
      searchText,
      searchLower,
      styles.globalSearchBtn,
      theme,
    ],
  );

  const renderLabel = useCallback(
    ({ route, color }: TabViewLabelProps) => {
      const novelIds = route?.novelIds?.filter(id => id !== 0);

      return (
        <Row>
          <Text style={[{ color }, styles.fontWeight500]}>{route.title}</Text>
          {showNumberOfNovels ? (
            <View
              style={[
                styles.badgeCtn,
                { backgroundColor: theme.surfaceVariant },
              ]}
            >
              <Text
                style={[styles.badgetText, { color: theme.onSurfaceVariant }]}
              >
                {novelIds.length}
              </Text>
            </View>
          ) : null}
        </Row>
      );
    },
    [
      showNumberOfNovels,
      styles.badgeCtn,
      styles.badgetText,
      styles.fontWeight500,
      theme.onSurfaceVariant,
      theme.surfaceVariant,
    ],
  );

  const handleLeftIconPress = useCallback(() => {
    if (selectedNovelIds.length > 0) {
      setSelectedNovelIds([]);
    }
  }, [selectedNovelIds.length]);

  const rightIcons = useMemo(
    () =>
      selectedNovelIds.length
        ? [
            {
              iconName: 'select-all' as const,
              onPress: () =>
                setSelectedNovelIds(currentNovels.map(novel => novel.id)),
            },
          ]
        : [
            {
              iconName: 'filter-variant' as const,
              onPress: () => bottomSheetRef.current?.present(),
            },
          ],
    [selectedNovelIds.length, currentNovels],
  );

  const menuButtons = useMemo(
    () => [
      {
        title: getString('libraryScreen.extraMenu.updateLibrary'),
        onPress: () =>
          backgroundTasks.enqueue({ name: 'UPDATE_LIBRARY' }),
      },
      {
        title: getString('libraryScreen.extraMenu.updateCategory'),
        onPress: () =>
          categories[index]?.id !== 2 &&
          backgroundTasks.enqueue({
            name: 'UPDATE_LIBRARY',
            data: {
              categoryId: categories[index].id,
              categoryName: categories[index].name,
            },
          }),
      },
      {
        title: getString('libraryScreen.extraMenu.importEpub'),
        onPress: pickAndImport,
      },
      {
        title: getString('libraryScreen.extraMenu.openRandom'),
        onPress: openRandom,
      },
    ],
    [categories, index, pickAndImport, openRandom],
  );

  const handleFABPress = useCallback(() => {
    if (history?.[0]) {
      navigation.navigate('ReaderStack', {
        screen: 'Chapter',
        params: {
          novel: {
            path: history[0].novelPath,
            pluginId: history[0].pluginId,
            name: history[0].novelName,
          } as NovelInfo,
          chapter: history[0],
        },
      });
    }
  }, [history, navigation]);

  const handleEditCategories = useCallback(() => setSelectedNovelIds([]), []);

  const handleCategorySuccess = useCallback(() => {
    setSelectedNovelIds([]);
    refetchLibrary();
  }, [refetchLibrary]);

  const bottomSheetStyle = useMemo(
    () => ({ marginStart: leftInset, marginEnd: rightInset }),
    [leftInset, rightInset],
  );

  const actionbarViewStyle = useMemo(
    () => ({ paddingStart: leftInset, paddingEnd: rightInset }),
    [leftInset, rightInset],
  );

  const markAllRead = useCallback(async () => {
    await Promise.all(selectedNovelIds.map(id => markAllChaptersRead(id)));
    setSelectedNovelIds([]);
    refetchLibrary();
  }, [selectedNovelIds, refetchLibrary]);

  const markAllUnread = useCallback(async () => {
    await Promise.all(selectedNovelIds.map(id => markAllChaptersUnread(id)));
    setSelectedNovelIds([]);
    refetchLibrary();
  }, [selectedNovelIds, refetchLibrary]);

  const deleteSelected = useCallback(async () => {
    await removeNovelsFromLibrary(selectedNovelIds);
    setSelectedNovelIds([]);
    refetchLibrary();
  }, [selectedNovelIds, refetchLibrary]);

  const actionbarActions = useMemo(
    () => [
      { icon: 'label-outline' as const, onPress: showSetCategoryModal },
      { icon: 'check' as const, onPress: markAllRead },
      { icon: 'check-outline' as const, onPress: markAllUnread },
      { icon: 'delete-outline' as const, onPress: deleteSelected },
    ],
    [showSetCategoryModal, markAllRead, markAllUnread, deleteSelected],
  );

  const navigationState = useMemo(
    () => ({
      index,
      routes: categories.map(category => ({
        key: String(category.id),
        title: category.name,
        id: category.id,
        name: category.name,
        sort: category.sort ?? 0,
        novelIds: category.novelIds,
      })),
    }),
    [categories, index],
  );

  return (
    <SafeAreaView excludeBottom>
      <SearchbarV2
        searchText={searchText}
        clearSearchbar={clearSearchbar}
        placeholder={searchbarPlaceholder}
        onLeftIconPress={handleLeftIconPress}
        onChangeText={setSearchText}
        leftIcon={selectedNovelIds.length ? 'close' : 'magnify'}
        rightIcons={rightIcons}
        menuButtons={menuButtons}
        theme={theme}
      />
      {downloadedOnlyMode ? (
        <Banner
          icon="cloud-off-outline"
          label={getString('moreScreen.downloadOnly')}
          theme={theme}
        />
      ) : null}
      {incognitoMode ? (
        <Banner
          icon="incognito"
          label={getString('moreScreen.incognitoMode')}
          theme={theme}
          backgroundColor={theme.tertiary}
          textColor={theme.onTertiary}
        />
      ) : null}

      <SelectionContext.Provider value={selectionContextValue}>
        <TabView
          commonOptions={{
            label: renderLabel,
          }}
          lazy
          navigationState={navigationState}
          renderTabBar={renderTabBar}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
        />
      </SelectionContext.Provider>

      {useLibraryFAB &&
      !isHistoryLoading &&
      history &&
      history.length !== 0 &&
      !error ? (
        <FAB
          style={[
            styles.fab,
            { backgroundColor: theme.primary, marginEnd: rightInset + 16 },
          ]}
          color={theme.onPrimary}
          uppercase={false}
          label={getString('common.resume')}
          icon="play"
          onPress={handleFABPress}
        />
      ) : null}
      <SetCategoryModal
        novelIds={selectedNovelIds}
        closeModal={closeSetCategoryModal}
        onEditCategories={handleEditCategories}
        visible={setCategoryModalVisible}
        onSuccess={handleCategorySuccess}
      />
      <LibraryBottomSheet
        bottomSheetRef={bottomSheetRef}
        style={bottomSheetStyle}
      />
      <Portal>
        <Actionbar
          viewStyle={actionbarViewStyle}
          active={hasSelection}
          actions={actionbarActions}
        />
      </Portal>
    </SafeAreaView>
  );
};

export default React.memo(LibraryScreen);

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    badgeCtn: {
      borderRadius: 50,
      marginStart: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      position: 'relative',
    },
    badgetText: {
      fontSize: 12,
    },
    fab: {
      bottom: 0,
      margin: 16,
      position: 'absolute',
      end: 0,
    },
    fontWeight500: {
      fontWeight: 500,
    },
    globalSearchBtn: {
      margin: 16,
    },
    tabBar: {
      borderBottomWidth: 1,
      elevation: 0,
    },
    tabBarIndicator: {
      backgroundColor: theme.primary,
      height: 3,
    },
    tabStyle: {
      minWidth: 100,
      width: 'auto',
    },
  });
}
