import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import React, { useCallback, useMemo, useState } from 'react';
import color from 'color';

import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { getPlugin } from '@plugins/pluginManager';
import { getString } from '@strings/translations';
import { useTheme } from '@hooks/persisted';

import { GlobalSearchResult } from '../hooks/useGlobalSearch';
import GlobalSearchSkeletonLoading from '@screens/browse/loadingAnimation/GlobalSearchSkeletonLoading';
import { interpolateColor } from 'react-native-reanimated';
import { useLibraryContext } from '@components/Context/LibraryContext';
import NovelCover from '@components/NovelCover';

interface GlobalSearchResultsListProps {
  searchResults: GlobalSearchResult[];
  ListEmptyComponent?: React.JSX.Element;
}

const GlobalSearchResultsList: React.FC<GlobalSearchResultsListProps> = ({
  searchResults,
  ListEmptyComponent,
}) => {
  const keyExtractor = useCallback(
    (item: GlobalSearchResult) => item.plugin.id,
    [],
  );

  return (
    <FlatList<GlobalSearchResult>
      keyExtractor={keyExtractor}
      data={searchResults}
      contentContainerStyle={styles.resultList}
      renderItem={({ item }) => <GlobalSearchSourceResults item={item} />}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const GlobalSearchSourceResults: React.FC<{ item: GlobalSearchResult }> = ({
  item,
}) => {
  const theme = useTheme();
  const navigation = useNavigation<StackNavigationProp<any>>();
  const [inActivity, setInActivity] = useState<Record<string, boolean>>({});
  const { novelInLibrary, switchNovelToLibrary } = useLibraryContext();
  const imageRequestInit = getPlugin(item.plugin.id)?.imageRequestInit;

  const errorColor = theme.isDark ? '#B3261E' : '#F2B8B5';
  const noResultsColor = interpolateColor(
    0.8,
    [0, 1],
    ['transparent', theme.onSurfaceVariant],
  );

  const navigateToNovel = useCallback(
    (novelItem: { name: string; path: string; pluginId: string }) =>
      navigation.push('ReaderStack', {
        screen: 'Novel',
        params: novelItem,
      }),
    [navigation],
  );

  return useMemo(
    () => (
      <>
        <View>
          <Pressable
            android_ripple={{
              color: color(theme.primary).alpha(0.12).string(),
            }}
            style={styles.sourceHeader}
            onPress={() =>
              navigation.navigate('SourceScreen', {
                pluginId: item.plugin.id,
                pluginName: item.plugin.name,
                site: item.plugin.site,
              })
            }
          >
            <View>
              <Text style={[styles.sourceName, { color: theme.onSurface }]}>
                {item.plugin.name}
              </Text>
              <Text
                style={[styles.language, { color: theme.onSurfaceVariant }]}
              >
                {item.plugin.lang}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="arrow-right"
              size={24}
              color={theme.onSurface}
            />
          </Pressable>
          {item.isLoading ? (
            <GlobalSearchSkeletonLoading theme={theme} />
          ) : item.error ? (
            <Text style={[styles.error, { color: errorColor }]}>
              {item.error}
            </Text>
          ) : (
            <FlatList
              horizontal
              contentContainerStyle={styles.novelsContainer}
              keyExtractor={novelItem => item.plugin.id + '_' + novelItem.path}
              data={item.novels}
              extraData={inActivity.length}
              ListEmptyComponent={
                <Text style={[styles.listEmpty, { color: noResultsColor }]}>
                  {getString('sourceScreen.noResultsFound')}
                </Text>
              }
              renderItem={({ item: novelItem }) => {
                const inLibrary = novelInLibrary(
                  item.plugin.id,
                  novelItem.path,
                );

                return (
                  <NovelCover
                    globalSearch
                    item={novelItem}
                    libraryStatus={inLibrary}
                    inActivity={inActivity[novelItem.path]}
                    onPress={() =>
                      navigateToNovel({
                        ...novelItem,
                        pluginId: item.plugin.id,
                      })
                    }
                    theme={theme}
                    onLongPress={async () => {
                      setInActivity(prev => ({
                        ...prev,
                        [novelItem.path]: true,
                      }));

                      await switchNovelToLibrary(
                        novelItem.path,
                        item.plugin.id,
                      );

                      setInActivity(prev => ({
                        ...prev,
                        [novelItem.path]: false,
                      }));
                    }}
                    selectedNovelIds={[]}
                    isSelected={false}
                    imageRequestInit={imageRequestInit}
                  />
                );
              }}
            />
          )}
        </View>
      </>
    ),
    [
      errorColor,
      inActivity,
      item.error,
      item.isLoading,
      item.novels,
      item.plugin.id,
      item.plugin.lang,
      item.plugin.name,
      item.plugin.site,
      navigateToNovel,
      navigation,
      imageRequestInit,
      noResultsColor,
      novelInLibrary,
      switchNovelToLibrary,
      theme,
    ],
  );
};

export default GlobalSearchResultsList;

const styles = StyleSheet.create({
  error: {
    marginBottom: 16,
    padding: 16,
  },
  language: {
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  listEmpty: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  novelsContainer: {
    padding: 8,
  },
  resultList: {
    flexGrow: 1,
    paddingBottom: 60,
    paddingTop: 8,
  },
  sourceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  sourceName: {
    marginBottom: 4,
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
