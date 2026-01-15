import React, { useCallback, useRef, useState } from 'react';

import { FAB } from 'react-native-paper';
import { ErrorScreenV2, SafeAreaView, SearchbarV2 } from '@components/index';
import NovelList from '@components/NovelList';
import NovelCover from '@components/NovelCover';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import FilterBottomSheet from './components/FilterBottomSheet';

import { useSearch } from '@hooks';
import { useTheme } from '@hooks/persisted';
import { useBrowseSource, useSearchSource } from './useBrowseSource';

import { NovelItem } from '@plugins/types';
import { getPlugin } from '@plugins/pluginManager';
import { getString } from '@strings/translations';
import { StyleSheet } from 'react-native';
import { NovelInfo } from '@database/types';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrowseSourceScreenProps } from '@navigators/types';
import { useLibraryContext } from '@components/Context/LibraryContext';

const BrowseSourceScreen = ({ route, navigation }: BrowseSourceScreenProps) => {
  const theme = useTheme();
  const { pluginId, pluginName, site, showLatestNovels } = route.params;
  const imageRequestInit = getPlugin(pluginId)?.imageRequestInit;

  const {
    isLoading,
    novels,
    hasNextPage,
    fetchNextPage,
    error,
    filterValues,
    setFilters,
    clearFilters,
    refetchNovels,
  } = useBrowseSource(pluginId, showLatestNovels);

  const {
    isSearching,
    searchResults,
    searchSource,
    searchNextPage,
    hasNextSearchPage,
    clearSearchResults,
    searchError,
  } = useSearchSource(pluginId);
  const novelList = searchResults.length > 0 ? searchResults : novels;
  const errorMessage = error || searchError;

  const { searchText, setSearchText, clearSearchbar } = useSearch();
  const onChangeText = (text: string) => setSearchText(text);
  const onSubmitEditing = () => {
    searchSource(searchText);
  };
  const handleClearSearchbar = () => {
    clearSearchbar();
    clearSearchResults();
  };

  const handleOpenWebView = async () => {
    navigation.navigate('WebviewScreen', {
      name: pluginName,
      url: site,
      pluginId,
    });
  };

  const { novelInLibrary, switchNovelToLibrary } = useLibraryContext();
  const [inActivity, setInActivity] = useState<Record<string, boolean>>({});

  const navigateToNovel = useCallback(
    (item: NovelItem | NovelInfo) =>
      navigation.navigate('ReaderStack', {
        screen: 'Novel',
        params: {
          ...item,
          pluginId: pluginId,
        },
      }),
    [navigation, pluginId],
  );

  const { bottom, right } = useSafeAreaInsets();
  const filterSheetRef = useRef<BottomSheetModal | null>(null);
  return (
    <SafeAreaView>
      <SearchbarV2
        searchText={searchText}
        leftIcon="magnify"
        placeholder={`${getString('common.search')} ${pluginName}`}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        clearSearchbar={handleClearSearchbar}
        handleBackAction={navigation.goBack}
        rightIcons={[{ iconName: 'earth', onPress: handleOpenWebView }]}
        theme={theme}
      />
      {isLoading || isSearching ? (
        <SourceScreenSkeletonLoading theme={theme} />
      ) : errorMessage || novelList.length === 0 ? (
        <ErrorScreenV2
          error={errorMessage || getString('sourceScreen.noResultsFound')}
          actions={[
            {
              iconName: 'refresh',
              title: getString('common.retry'),
              onPress: () => {
                if (searchText) {
                  searchSource(searchText);
                } else {
                  refetchNovels();
                }
              },
            },
          ]}
        />
      ) : (
        <NovelList
          data={novelList}
          inSource
          renderItem={({ item }) => {
            const inLibrary = novelInLibrary(pluginId, item.path);

            return (
              <NovelCover
                item={item}
                theme={theme}
                libraryStatus={inLibrary}
                inActivity={inActivity[item.path]}
                onPress={() => navigateToNovel(item)}
                isSelected={false}
                addSkeletonLoading={
                  (hasNextPage && !searchText) ||
                  (hasNextSearchPage && Boolean(searchText))
                }
                onLongPress={async () => {
                  setInActivity(prev => ({ ...prev, [item.path]: true }));

                  await switchNovelToLibrary(item.path, pluginId);

                  setInActivity(prev => ({ ...prev, [item.path]: false }));
                }}
                selectedNovelIds={[]}
                imageRequestInit={imageRequestInit}
              />
            );
          }}
          onEndReached={() => {
            if (searchText) {
              if (hasNextSearchPage) {
                searchNextPage();
              }
            } else if (hasNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={1.5}
        />
      )}
      {!showLatestNovels && filterValues && !searchText ? (
        <>
          <FAB
            icon={'filter-variant'}
            style={[
              styles.filterFab,
              {
                backgroundColor: theme.primary,
                marginBottom: bottom + 16,
                marginEnd: right + 16,
              },
            ]}
            label={getString('common.filter')}
            uppercase={false}
            color={theme.onPrimary}
            onPress={() => filterSheetRef?.current?.present()}
          />
          <FilterBottomSheet
            filterSheetRef={filterSheetRef}
            filters={filterValues}
            setFilters={setFilters}
            clearFilters={clearFilters}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
};

export default BrowseSourceScreen;

const styles = StyleSheet.create({
  filterFab: {
    bottom: 0,
    margin: 16,
    position: 'absolute',
    end: 0,
  },
});
