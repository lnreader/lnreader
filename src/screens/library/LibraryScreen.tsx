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
import { getString } from '@strings/translations';
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
import ServiceManager from '@services/ServiceManager';
import useImport from '@hooks/persisted/useImport';
import { ThemeColors } from '@theme/types';
import { useLibraryContext } from '@components/Context/LibraryContext';

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
  const styles = createStyles(theme);
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

  const handleClearSearchbar = () => {
    clearSearchbar();
  };

  const [selectedNovelIds, setSelectedNovelIds] = useState<number[]>([]);

  const currentNovels = useMemo(() => {
    if (!categories.length) return [];

    const ids = categories[index].novelIds;
    return library.filter(l => ids.includes(l.id));
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

  function openRandom() {
    const novels = currentNovels;
    const randomNovel = novels[Math.floor(Math.random() * novels.length)];
    if (randomNovel) {
      navigation.navigate('ReaderStack', {
        screen: 'Novel',
        params: randomNovel,
      });
    }
  }

  const pickAndImport = useCallback(() => {
    DocumentPicker.getDocumentAsync({
      type: 'application/epub+zip',
      copyToCacheDirectory: true,
      multiple: true,
    }).then(importNovel);
  }, [importNovel]);

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
              borderBottomColor: Color(theme.isDark ? '#FFFFFF' : '#000000')
                .alpha(0.12)
                .string(),
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
      theme.isDark,
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
      const ids = route.novelIds;
      const unfilteredNovels = library.filter(l => ids.includes(l.id));

      const novels = unfilteredNovels.filter(
        n =>
          n.name.toLowerCase().includes(searchText.toLowerCase()) ||
          (n.author?.toLowerCase().includes(searchText.toLowerCase()) ?? false),
      );

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
            selectedNovelIds={selectedNovelIds}
            setSelectedNovelIds={setSelectedNovelIds}
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
      selectedNovelIds,
      styles.globalSearchBtn,
      theme,
    ],
  );

  const renderLabel = useCallback(
    ({ route, color }: TabViewLabelProps) => {
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
                {route?.novelIds.length}
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

  const navigationState = useMemo(
    () => ({
      index,
      routes: categories.map(category => ({
        key: String(category.id),
        title: category.name,
        ...category,
      })),
    }),
    [categories, index],
  );

  return (
    <SafeAreaView excludeBottom>
      <SearchbarV2
        searchText={searchText}
        clearSearchbar={handleClearSearchbar}
        placeholder={searchbarPlaceholder}
        onLeftIconPress={() => {
          if (selectedNovelIds.length > 0) {
            setSelectedNovelIds([]);
          }
        }}
        onChangeText={setSearchText}
        leftIcon={selectedNovelIds.length ? 'close' : 'magnify'}
        rightIcons={
          selectedNovelIds.length
            ? [
              {
                iconName: 'select-all',
                onPress: () =>
                  setSelectedNovelIds(currentNovels.map(novel => novel.id)),
              },
            ]
            : [
              {
                iconName: 'filter-variant',
                onPress: () => bottomSheetRef.current?.present(),
              },
            ]
        }
        menuButtons={[
          {
            title: getString('libraryScreen.extraMenu.updateLibrary'),
            onPress: () =>
              ServiceManager.manager.addTask({
                name: 'UPDATE_LIBRARY',
              }),
          },
          {
            title: getString('libraryScreen.extraMenu.updateCategory'),
            onPress: () =>
              //2 = local category
              library[index].id !== 2 &&
              ServiceManager.manager.addTask({
                name: 'UPDATE_LIBRARY',
                data: {
                  categoryId: library[index].id,
                  categoryName: library[index].name,
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
        ]}
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
          onPress={() => {
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
          }}
        />
      ) : null}
      <SetCategoryModal
        novelIds={selectedNovelIds}
        closeModal={closeSetCategoryModal}
        onEditCategories={() => setSelectedNovelIds([])}
        visible={setCategoryModalVisible}
        onSuccess={() => {
          setSelectedNovelIds([]);
          refetchLibrary();
        }}
      />
      <LibraryBottomSheet
        bottomSheetRef={bottomSheetRef}
        style={{ marginStart: leftInset, marginEnd: rightInset }}
      />
      <Portal>
        <Actionbar
          viewStyle={{ paddingStart: leftInset, paddingEnd: rightInset }}
          active={selectedNovelIds.length > 0}
          actions={[
            {
              icon: 'label-outline',
              onPress: showSetCategoryModal,
            },
            {
              icon: 'check',
              onPress: async () => {
                const promises: Promise<any>[] = [];
                selectedNovelIds.map(id =>
                  promises.push(markAllChaptersRead(id)),
                );
                await Promise.all(promises);
                setSelectedNovelIds([]);
                refetchLibrary();
              },
            },
            {
              icon: 'check-outline',
              onPress: async () => {
                const promises: Promise<any>[] = [];
                selectedNovelIds.map(id =>
                  promises.push(markAllChaptersUnread(id)),
                );
                await Promise.all(promises);
                setSelectedNovelIds([]);
                refetchLibrary();
              },
            },
            {
              icon: 'delete-outline',
              onPress: () => {
                removeNovelsFromLibrary(selectedNovelIds);
                setSelectedNovelIds([]);
                refetchLibrary();
              },
            },
          ]}
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
      marginStart: 2,
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
