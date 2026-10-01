import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Box } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import {
  AppHost,
  Actionbar,
  Button,
  EmptyView,
  ErrorScreenV2,
  Fab,
  Screen,
  SearchbarV2,
  TabPager,
  useScreenInsets,
} from '@components/index';
import { LibraryView } from './components/LibraryListView';
import LibraryBottomSheet from './components/LibraryBottomSheet/LibraryBottomSheet';
import { Banner } from './components/Banner';
import CategoryPane, { CATEGORY_PANE_WIDTH } from './components/CategoryPane';

import { useAppSettings, useHistory, useTheme } from '@hooks/persisted';
import { useSearch, useBackHandler, useBoolean } from '@hooks';
import { useWindowLayout } from '@hooks/common/useWindowLayout';
import { getString } from '@i18n/translations';
import {
  markAllChaptersRead,
  markAllChaptersUnread,
} from '@database/queries/ChapterQueries';
import { removeNovelsFromLibrary } from '@database/queries/NovelQueries';
import SetCategoryModal from '@screens/novel/components/SetCategoriesModal';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { LibraryScreenProps } from '@navigators/types';
import { History, NovelInfo } from '@database/types';
import * as DocumentPicker from 'expo-document-picker';
import { backgroundTasks } from '@services/backgroundTasks';
import useImport from '@hooks/persisted/useImport';
import { useLibraryContext } from '@components/Context/LibraryContext';
import xor from 'lodash-es/xor';
import { SelectionContext } from './SelectionContext';
import { getLibraryCategoryIndex } from './constants/constants';
import CloseIcon from '@expo/material-symbols/close.xml';
import RefreshIcon from '@expo/material-symbols/refresh.xml';
import CloudOffIcon from '@expo/material-symbols/cloud_off.xml';
import DeleteIcon from '@expo/material-symbols/delete.xml';
import DoneAllIcon from '@expo/material-symbols/done_all.xml';
import ExploreIcon from '@expo/material-symbols/explore.xml';
import FilterListIcon from '@expo/material-symbols/filter_list.xml';
import LabelIcon from '@expo/material-symbols/label.xml';
import PlayArrowIcon from '@expo/material-symbols/play_arrow.xml';
import RemoveDoneIcon from '@expo/material-symbols/remove_done.xml';
import SearchIcon from '@expo/material-symbols/search.xml';
import FlipToBackIcon from '@expo/material-symbols/flip_to_back.xml';
import SelectAllIcon from '@expo/material-symbols/select_all.xml';
import VisibilityOffIcon from '@expo/material-symbols/visibility_off.xml';

type LibraryRoute = {
  id: number;
  name: string;
  sort: number;
  novelIds: number[];
  key: string;
  title: string;
};

const LibraryScreen = ({ navigation }: LibraryScreenProps) => {
  const { searchText, setSearchText, clearSearchbar } = useSearch();
  const theme = useTheme();
  const { left: leftInset, right: rightInset } = useScreenInsets();
  const {
    library,
    categories,
    refetchLibrary,
    isLoading,
    error: libraryError,
    settings: {
      showNumberOfNovels,
      showContinueReadingButton = false,
      downloadedOnlyMode,
      incognitoMode,
      lastUsedCategoryId,
      setLibrarySettings,
    },
  } = useLibraryContext();

  const { importNovel } = useImport();
  const { useLibraryFAB = false } = useAppSettings();

  const { isLoading: isHistoryLoading, history, error } = useHistory();
  const historyByNovelId = useMemo(() => {
    const chapters = new Map<number, History>();
    history.forEach(chapter => chapters.set(chapter.novelId, chapter));
    return chapters;
  }, [history]);

  const layout = useWindowLayout();

  const {
    value: bottomSheetVisible,
    setTrue: showBottomSheet,
    setFalse: closeBottomSheet,
  } = useBoolean();

  const [selectedCategoryId, setSelectedCategoryId] =
    useState(lastUsedCategoryId);
  const index = getLibraryCategoryIndex(categories, selectedCategoryId);
  const setIndex = useCallback(
    (nextIndex: number) => {
      const categoryId = categories[nextIndex]?.id;
      if (categoryId !== undefined) {
        setSelectedCategoryId(categoryId);
        setLibrarySettings({ lastUsedCategoryId: categoryId });
      }
    },
    [categories, setLibrarySettings],
  );

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

          showBottomSheet();
        }
      }),
    [navigation, showBottomSheet],
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

  const navigationState = useMemo(
    () => ({
      index,
      routes: categories.map(
        (category): LibraryRoute => ({
          key: String(category.id),
          title: category.name,
          id: category.id,
          name: category.name,
          sort: category.sort ?? 0,
          novelIds: category.novelIds,
        }),
      ),
    }),
    [categories, index],
  );

  const tabs = useMemo(
    () =>
      navigationState.routes.map((route, i) => ({
        key: i,
        label: route.title,
        count: route.novelIds.filter(id => id !== 0).length,
      })),
    [navigationState],
  );

  const panesWidth =
    layout.width -
    leftInset -
    rightInset -
    (layout.isExpanded ? CATEGORY_PANE_WIDTH : 0);

  const renderScene = useCallback(
    ({ route }: { route: LibraryRoute }) => {
      const idsSet = new Set(route.novelIds);
      const unfilteredNovels = library.filter(l => idsSet.has(l.id));

      const novels = searchLower
        ? unfilteredNovels.filter(
            n =>
              n.name.toLowerCase().includes(searchLower) ||
              (n.author?.toLowerCase().includes(searchLower) ?? false),
          )
        : unfilteredNovels;

      return (
        <LibraryView
          categoryId={route.id}
          categoryName={route.name}
          novels={novels}
          pickAndImport={pickAndImport}
          navigation={navigation}
          historyByNovelId={historyByNovelId}
          showContinueReadingButton={showContinueReadingButton}
          availableWidth={panesWidth}
          // Clear of the rounded corner of the tablet pane.
          topPadding={layout.isExpanded ? 16 : undefined}
          header={
            searchText ? (
              <Box modifiers={[fillMaxWidth(), padding(0, 0, 0, 12)]}>
                <Button
                  mode="contained-tonal"
                  title={`${getString(
                    'common.searchFor',
                  )} "${searchText}" ${getString('common.globally')}`}
                  onPress={() =>
                    navigation.navigate('GlobalSearchScreen', {
                      searchText,
                    })
                  }
                />
              </Box>
            ) : null
          }
        />
      );
    },
    [
      library,
      historyByNovelId,
      showContinueReadingButton,
      navigation,
      pickAndImport,
      searchText,
      searchLower,
      panesWidth,
      layout.isExpanded,
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
              iconName: SelectAllIcon,
              onPress: () =>
                setSelectedNovelIds(currentNovels.map(novel => novel.id)),
            },
            {
              iconName: FlipToBackIcon,
              onPress: () =>
                setSelectedNovelIds(
                  currentNovels
                    .filter(novel => !selectedNovelIds.includes(novel.id))
                    .map(novel => novel.id),
                ),
            },
          ]
        : [
            {
              iconName: FilterListIcon,
              onPress: showBottomSheet,
            },
          ],
    [selectedNovelIds, currentNovels, showBottomSheet],
  );

  const menuButtons = useMemo(
    () => [
      {
        title: getString('libraryScreen.extraMenu.updateLibrary'),
        onPress: () => backgroundTasks.enqueue({ name: 'UPDATE_LIBRARY' }),
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
            id: history[0].novelId,
            path: history[0].novelPath,
            pluginId: history[0].pluginId,
            name: history[0].novelName,
            cover: history[0].novelCover,
            inLibrary: history[0].inLibrary,
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
      { icon: LabelIcon, onPress: showSetCategoryModal },
      { icon: DoneAllIcon, onPress: markAllRead },
      { icon: RemoveDoneIcon, onPress: markAllUnread },
      { icon: DeleteIcon, onPress: deleteSelected },
    ],
    [showSetCategoryModal, markAllRead, markAllUnread, deleteSelected],
  );

  const content = () => {
    if (isLoading) {
      return { content: <SourceScreenSkeletonLoading theme={theme} /> };
    }
    if (libraryError) {
      return {
        content: (
          <ErrorScreenV2
            error={libraryError}
            actions={[
              {
                iconName: RefreshIcon,
                title: getString('common.retry'),
                onPress: refetchLibrary,
              },
            ]}
          />
        ),
      };
    }
    if (!categories.length) {
      return {
        content: (
          <EmptyView
            icon="Σ(ಠ_ಠ)"
            description={getString('libraryScreen.emptyCategory')}
            actions={[
              {
                iconName: ExploreIcon,
                title: getString('browse'),
                onPress: () => navigation.navigate('Browse'),
              },
            ]}
            theme={theme}
          />
        ),
      };
    }
    if (layout.isExpanded) {
      return {
        list: (
          <View style={styles.panes}>
            <AppHost style={styles.categoryPane}>
              <CategoryPane
                categories={categories}
                selectedIndex={index}
                onSelect={setIndex}
                showCounts={!!showNumberOfNovels}
                onEdit={() =>
                  navigation.navigate('MoreStack', { screen: 'Categories' })
                }
              />
            </AppHost>
            <View
              style={[
                styles.pane,
                { backgroundColor: theme.surfaceContainerLow },
              ]}
            >
              {renderScene({ route: navigationState.routes[index] })}
            </View>
          </View>
        ),
      };
    }
    return {
      list: (
        <TabPager
          tabs={tabs}
          index={index}
          onIndexChange={setIndex}
          renderPage={i => renderScene({ route: navigationState.routes[i] })}
          showCounts={showNumberOfNovels}
        />
      ),
    };
  };

  const body = content();

  return (
    <SelectionContext.Provider value={selectionContextValue}>
      <Screen
        list={body.list}
        topBar={
          <>
            <SearchbarV2
              searchText={searchText}
              clearSearchbar={clearSearchbar}
              placeholder={searchbarPlaceholder}
              onLeftIconPress={handleLeftIconPress}
              onChangeText={setSearchText}
              leftIcon={selectedNovelIds.length ? CloseIcon : SearchIcon}
              rightIcons={rightIcons}
              menuButtons={menuButtons}
              theme={theme}
            />
            {downloadedOnlyMode ? (
              <Banner
                icon={CloudOffIcon}
                label={getString('moreScreen.downloadOnly')}
                theme={theme}
              />
            ) : null}
            {incognitoMode ? (
              <Banner
                icon={VisibilityOffIcon}
                label={getString('moreScreen.incognitoMode')}
                theme={theme}
                backgroundColor={theme.tertiary}
                textColor={theme.onTertiary}
              />
            ) : null}
          </>
        }
        bottomBar={
          hasSelection ? (
            <Actionbar active actions={actionbarActions} />
          ) : undefined
        }
        floatingAction={
          useLibraryFAB &&
          !isHistoryLoading &&
          history &&
          history.length !== 0 &&
          !error &&
          !hasSelection ? (
            <Fab
              extended
              icon={PlayArrowIcon}
              label={getString('common.resume')}
              onPress={handleFABPress}
            />
          ) : undefined
        }
        overlays={
          <>
            <SetCategoryModal
              novelIds={selectedNovelIds}
              closeModal={closeSetCategoryModal}
              onEditCategories={handleEditCategories}
              visible={setCategoryModalVisible}
              onSuccess={handleCategorySuccess}
            />
            <LibraryBottomSheet
              visible={bottomSheetVisible}
              onDismiss={closeBottomSheet}
            />
          </>
        }
      >
        {body.content}
      </Screen>
    </SelectionContext.Provider>
  );
};

export default React.memo(LibraryScreen);

const styles = StyleSheet.create({
  panes: { flex: 1, flexDirection: 'row', paddingTop: 8 },
  categoryPane: { width: CATEGORY_PANE_WIDTH },
  pane: { flex: 1, borderTopLeftRadius: 28, overflow: 'hidden' },
});
