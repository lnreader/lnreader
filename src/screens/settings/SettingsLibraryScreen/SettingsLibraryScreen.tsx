import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Appbar, List, SafeAreaView } from '@components';
import { useBoolean } from '@hooks';
import {
  useAppSettings,
  useCategories,
  useLastUpdate,
  useLibrarySettings,
  useTheme,
} from '@hooks/persisted';
import { getString } from '@i18n/translations';
import type { StringMap } from '@i18n/types';
import { LibrarySettingsScreenProps } from '@navigators/types';
import {
  DisplayModes,
  displayModesList,
  LibrarySortOrder,
} from '@screens/library/constants/constants';
import { Portal } from 'react-native-paper';
import {
  configureAutomaticLibraryUpdates,
  type AutomaticLibraryUpdateInterval,
} from '@services/backgroundTasks';
import { showToast } from '@utils/showToast';

import AutomaticUpdatesDialog from './AutomaticUpdatesDialog';
import DefaultChapterSortModal from '../components/DefaultChapterSortModal';
import SettingSwitch from '../components/SettingSwitch';
import DefaultCategoryDialog from './DefaultCategoryDialog';
import GlobalUpdateCategoriesDialog from './GlobalUpdateCategoriesDialog';
import SmartUpdateDialog from './SmartUpdateDialog';
import DisplayModeModal from './modals/DisplayModeModal';
import GridSizeModal from './modals/GridSizeModal';
import NovelBadgesModal from './modals/NovelBadgesModal';
import NovelSortModal from './modals/NovelSortModal';

type LibrarySortLabel = Extract<
  keyof StringMap,
  `libraryScreen.bottomSheet.sortOrders.${string}`
>;

const SORT_ORDER_LABELS: Record<string, LibrarySortLabel> = {
  name: 'libraryScreen.bottomSheet.sortOrders.alphabetically',
  chaptersDownloaded: 'libraryScreen.bottomSheet.sortOrders.download',
  chaptersUnread: 'libraryScreen.bottomSheet.sortOrders.totalChapters',
  id: 'libraryScreen.bottomSheet.sortOrders.dateAdded',
  lastReadAt: 'libraryScreen.bottomSheet.sortOrders.lastRead',
  lastUpdatedAt: 'libraryScreen.bottomSheet.sortOrders.lastUpdated',
};

const AUTOMATIC_UPDATE_LABELS: Record<
  AutomaticLibraryUpdateInterval,
  keyof StringMap
> = {
  0: 'generalSettingsScreen.automaticUpdatesOff',
  12: 'generalSettingsScreen.automaticUpdatesEvery12Hours',
  24: 'generalSettingsScreen.automaticUpdatesDaily',
  48: 'generalSettingsScreen.automaticUpdatesEvery2Days',
  72: 'generalSettingsScreen.automaticUpdatesEvery3Days',
  168: 'generalSettingsScreen.automaticUpdatesWeekly',
};

const SettingsLibraryScreen = ({ navigation }: LibrarySettingsScreenProps) => {
  const theme = useTheme();
  const {
    displayMode = DisplayModes.Comfortable,
    novelsPerRow = 3,
    showDownloadBadges = true,
    showNumberOfNovels = false,
    showUnreadBadges = true,
    showContinueReadingButton = false,
    sortOrder = LibrarySortOrder.DateAdded_DESC,
    defaultCategoryId,
    promptForCategoryOnAdd = false,
    globalUpdateExcludeCategoryIds = [],
    globalUpdateIncludeCategoryIds = [],
    setLibrarySettings,
  } = useLibrarySettings();
  const {
    automaticLibraryUpdateIntervalHours = 0,
    autoDeleteReadChapters = false,
    defaultChapterSort,
    downloadNewChapters,
    refreshNovelMetadata,
    setAppSettings,
    smartUpdateSkipCompleted = false,
    smartUpdateSkipUnstarted = false,
    smartUpdateSkipWithUnread = false,
    updateLibraryOnLaunch,
    useLibraryFAB,
  } = useAppSettings();
  const { showLastUpdateTime, setShowLastUpdateTime } = useLastUpdate();
  const { categories } = useCategories();

  const displayModal = useBoolean();
  const automaticUpdatesDialog = useBoolean();
  const defaultCategoryDialog = useBoolean();
  const globalUpdateCategoriesDialog = useBoolean();
  const gridSizeModal = useBoolean();
  const novelBadgesModal = useBoolean();
  const novelSortModal = useBoolean();
  const smartUpdateDialog = useBoolean();
  const defaultChapterSortModal = useBoolean();
  const appDefaultCategory = categories.find(category => category.id === 1);
  const selectedDefaultCategory = categories.find(
    category => category.id === defaultCategoryId,
  );
  const selectableCategories = categories.filter(
    category => category.id === 1 || category.id > 2,
  );
  const globalUpdateCategories = categories.filter(
    category => category.id !== 2,
  );
  const [draftIncludedCategoryIds, setDraftIncludedCategoryIds] = useState<
    number[]
  >([]);
  const [draftExcludedCategoryIds, setDraftExcludedCategoryIds] = useState<
    number[]
  >([]);
  const [draftSmartUpdateFilters, setDraftSmartUpdateFilters] = useState({
    skipCompleted: false,
    skipUnstarted: false,
    skipWithUnread: false,
  });

  const setDefaultCategory = (categoryId: number) => {
    setLibrarySettings({
      defaultCategoryId: categoryId === 1 ? undefined : categoryId,
      promptForCategoryOnAdd: false,
    });
    defaultCategoryDialog.setFalse();
  };

  const setPromptForCategoryOnAdd = () => {
    setLibrarySettings({
      defaultCategoryId: undefined,
      promptForCategoryOnAdd: true,
    });
    defaultCategoryDialog.setFalse();
  };

  const showGlobalUpdateCategoriesDialog = () => {
    setDraftIncludedCategoryIds(globalUpdateIncludeCategoryIds);
    setDraftExcludedCategoryIds(globalUpdateExcludeCategoryIds);
    globalUpdateCategoriesDialog.setTrue();
  };

  const updateDraftCategoryFilters = useCallback(
    (includedCategoryIds: number[], excludedCategoryIds: number[]) => {
      setDraftIncludedCategoryIds(includedCategoryIds);
      setDraftExcludedCategoryIds(excludedCategoryIds);
    },
    [],
  );

  const saveGlobalUpdateCategories = () => {
    setLibrarySettings({
      globalUpdateExcludeCategoryIds: draftExcludedCategoryIds,
      globalUpdateIncludeCategoryIds: draftIncludedCategoryIds,
    });
    globalUpdateCategoriesDialog.setFalse();
  };

  const showSmartUpdateDialog = () => {
    setDraftSmartUpdateFilters({
      skipCompleted: smartUpdateSkipCompleted,
      skipUnstarted: smartUpdateSkipUnstarted,
      skipWithUnread: smartUpdateSkipWithUnread,
    });
    smartUpdateDialog.setTrue();
  };

  const saveSmartUpdateFilters = () => {
    setAppSettings({
      smartUpdateSkipCompleted: draftSmartUpdateFilters.skipCompleted,
      smartUpdateSkipUnstarted: draftSmartUpdateFilters.skipUnstarted,
      smartUpdateSkipWithUnread: draftSmartUpdateFilters.skipWithUnread,
    });
    smartUpdateDialog.setFalse();
  };

  const getCategoryFilterDescription = (
    categoryIds: number[],
    emptyLabel: string,
  ) => {
    if (categoryIds.length === 0) {
      return emptyLabel;
    }

    const names = globalUpdateCategories
      .filter(category => categoryIds.includes(category.id))
      .map(category => category.name);
    return names.length > 0 ? names.join(', ') : getString('common.none');
  };

  const includedCategoriesDescription = getCategoryFilterDescription(
    globalUpdateIncludeCategoryIds,
    getString('common.all'),
  );
  const excludedCategoriesDescription = getCategoryFilterDescription(
    globalUpdateExcludeCategoryIds,
    getString('common.none'),
  );
  const smartUpdateDescription = [
    smartUpdateSkipWithUnread
      ? getString('generalSettingsScreen.smartUpdateSkipWithUnread')
      : null,
    smartUpdateSkipUnstarted
      ? getString('generalSettingsScreen.smartUpdateSkipUnstarted')
      : null,
    smartUpdateSkipCompleted
      ? getString('generalSettingsScreen.smartUpdateSkipCompleted')
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  const setAutomaticUpdateInterval = async (
    intervalHours: AutomaticLibraryUpdateInterval,
  ) => {
    try {
      await configureAutomaticLibraryUpdates(intervalHours);
      setAppSettings({ automaticLibraryUpdateIntervalHours: intervalHours });
      automaticUpdatesDialog.setFalse();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  };

  const sortOrderParts = sortOrder.split(' ');
  const sortOrderLabel =
    SORT_ORDER_LABELS[sortOrderParts[0]] ??
    'libraryScreen.bottomSheet.sortOrders.dateAdded';

  const badgeDescription = [
    showDownloadBadges
      ? getString('libraryScreen.bottomSheet.display.download')
      : null,
    showUnreadBadges
      ? getString('libraryScreen.bottomSheet.display.unread')
      : null,
    showNumberOfNovels
      ? getString('libraryScreen.bottomSheet.display.numberOfItems')
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('library')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView contentContainerStyle={styles.paddingBottom}>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('common.display')}
          </List.SubHeader>
          <List.Item
            title={getString('generalSettingsScreen.displayMode')}
            description={displayModesList[displayMode].label}
            onPress={displayModal.setTrue}
            theme={theme}
          />
          <List.Item
            title={getString('generalSettingsScreen.itemsPerRowLibrary')}
            description={`${novelsPerRow} ${getString(
              'generalSettingsScreen.itemsPerRow',
            )}`}
            onPress={gridSizeModal.setTrue}
            theme={theme}
          />
          <List.Item
            title={getString('generalSettingsScreen.novelBadges')}
            description={badgeDescription}
            onPress={novelBadgesModal.setTrue}
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.showContinueReadingButton')}
            value={showContinueReadingButton}
            onPress={() =>
              setLibrarySettings({
                showContinueReadingButton: !showContinueReadingButton,
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('generalSettingsScreen.novelSort')}
            description={`${getString(sortOrderLabel)} ${sortOrderParts[1]}`}
            onPress={novelSortModal.setTrue}
            theme={theme}
          />
          <List.SubHeader theme={theme}>{getString('library')}</List.SubHeader>
          <List.Item
            title={getString('categories.header')}
            description={`${categories.length} ${getString(
              'common.categories',
            ).toLowerCase()}`}
            onPress={() => navigation.navigate('Categories')}
            theme={theme}
          />
          <List.Item
            title={getString('categories.defaultCategory')}
            description={
              promptForCategoryOnAdd
                ? getString('categories.alwaysAsk')
                : selectedDefaultCategory?.name ?? appDefaultCategory?.name
            }
            onPress={defaultCategoryDialog.setTrue}
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.updateLibrary')}
            description={getString('generalSettingsScreen.updateLibraryDesc')}
            value={updateLibraryOnLaunch}
            onPress={() =>
              setAppSettings({ updateLibraryOnLaunch: !updateLibraryOnLaunch })
            }
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.useFAB')}
            description={getString('generalSettingsScreen.useFABDescription')}
            value={useLibraryFAB}
            onPress={() => setAppSettings({ useLibraryFAB: !useLibraryFAB })}
            theme={theme}
          />
          <List.Item
            title={getString('generalSettingsScreen.chapterSort')}
            description={`${getString('generalSettingsScreen.bySource')} ${
              defaultChapterSort === 'positionAsc'
                ? getString('generalSettingsScreen.asc')
                : getString('generalSettingsScreen.desc')
            }`}
            onPress={defaultChapterSortModal.setTrue}
            theme={theme}
          />
          <List.SubHeader theme={theme}>
            {getString('generalSettingsScreen.globalUpdate')}
          </List.SubHeader>
          <List.Item
            title={getString('generalSettingsScreen.automaticUpdates')}
            description={getString(
              AUTOMATIC_UPDATE_LABELS[automaticLibraryUpdateIntervalHours],
            )}
            onPress={automaticUpdatesDialog.setTrue}
            theme={theme}
          />
          <List.Item
            title={getString('generalSettingsScreen.globalUpdateCategories')}
            description={`${getString(
              'generalSettingsScreen.globalUpdateInclude',
              { categories: includedCategoriesDescription },
            )}\n${getString('generalSettingsScreen.globalUpdateExclude', {
              categories: excludedCategoriesDescription,
            })}`}
            onPress={showGlobalUpdateCategoriesDialog}
            theme={theme}
          />
          <List.Item
            title={getString('generalSettingsScreen.smartUpdate')}
            description={smartUpdateDescription || getString('common.none')}
            onPress={showSmartUpdateDialog}
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.refreshMetadata')}
            description={getString(
              'generalSettingsScreen.refreshMetadataDescription',
            )}
            value={refreshNovelMetadata}
            onPress={() =>
              setAppSettings({ refreshNovelMetadata: !refreshNovelMetadata })
            }
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.updateTime')}
            value={showLastUpdateTime}
            onPress={() => setShowLastUpdateTime(!showLastUpdateTime)}
            theme={theme}
          />
          <List.SubHeader theme={theme}>
            {getString('generalSettingsScreen.autoDownload')}
          </List.SubHeader>
          <SettingSwitch
            label={getString('generalSettingsScreen.downloadNewChapters')}
            value={downloadNewChapters}
            onPress={() =>
              setAppSettings({ downloadNewChapters: !downloadNewChapters })
            }
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.autoDeleteReadChapters')}
            description={getString(
              'generalSettingsScreen.autoDeleteReadChaptersDescription',
            )}
            value={autoDeleteReadChapters}
            onPress={() =>
              setAppSettings({
                autoDeleteReadChapters: !autoDeleteReadChapters,
              })
            }
            theme={theme}
          />
        </List.Section>
      </ScrollView>
      <DisplayModeModal
        displayMode={displayMode}
        displayModalVisible={displayModal.value}
        hideDisplayModal={displayModal.setFalse}
        theme={theme}
      />
      <DefaultChapterSortModal
        defaultChapterSort={defaultChapterSort}
        displayModalVisible={defaultChapterSortModal.value}
        hideDisplayModal={defaultChapterSortModal.setFalse}
        setAppSettings={setAppSettings}
        theme={theme}
      />
      <GridSizeModal
        novelsPerRow={novelsPerRow}
        gridSizeModalVisible={gridSizeModal.value}
        hideGridSizeModal={gridSizeModal.setFalse}
        theme={theme}
      />
      <NovelBadgesModal
        novelBadgesModalVisible={novelBadgesModal.value}
        hideNovelBadgesModal={novelBadgesModal.setFalse}
        theme={theme}
      />
      <NovelSortModal
        novelSortModalVisible={novelSortModal.value}
        hideNovelSortModal={novelSortModal.setFalse}
        theme={theme}
      />
      <Portal>
        <AutomaticUpdatesDialog
          intervalHours={automaticLibraryUpdateIntervalHours}
          visible={automaticUpdatesDialog.value}
          onCancel={automaticUpdatesDialog.setFalse}
          onSelect={setAutomaticUpdateInterval}
        />
        <DefaultCategoryDialog
          categories={selectableCategories}
          defaultCategoryId={selectedDefaultCategory?.id ?? 1}
          promptForCategoryOnAdd={promptForCategoryOnAdd}
          setPromptForCategoryOnAdd={setPromptForCategoryOnAdd}
          visible={defaultCategoryDialog.value}
          hideDialog={defaultCategoryDialog.setFalse}
          setDefaultCategory={setDefaultCategory}
        />
        <GlobalUpdateCategoriesDialog
          categories={globalUpdateCategories}
          excludedCategoryIds={draftExcludedCategoryIds}
          includedCategoryIds={draftIncludedCategoryIds}
          visible={globalUpdateCategoriesDialog.value}
          onCancel={globalUpdateCategoriesDialog.setFalse}
          onChange={updateDraftCategoryFilters}
          onSave={saveGlobalUpdateCategories}
        />
        <SmartUpdateDialog
          filters={draftSmartUpdateFilters}
          visible={smartUpdateDialog.value}
          onCancel={smartUpdateDialog.setFalse}
          onChange={setDraftSmartUpdateFilters}
          onSave={saveSmartUpdateFilters}
        />
      </Portal>
    </SafeAreaView>
  );
};

export default SettingsLibraryScreen;

const styles = StyleSheet.create({
  paddingBottom: {
    paddingBottom: 24,
  },
});
