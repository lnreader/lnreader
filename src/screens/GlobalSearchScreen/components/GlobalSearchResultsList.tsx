import React, { useCallback, useMemo, useState } from 'react';
import { Box, Column, LazyRow, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { getPlugin } from '@plugins/pluginManager';
import { getString } from '@i18n/translations';
import { useTheme } from '@hooks/persisted/useTheme';
import { getLocaleLanguageName } from '@utils/constants/languages';

import { GlobalSearchResult } from '../hooks/useGlobalSearch';
import GlobalSearchSkeletonLoading from '@screens/browse/loadingAnimation/GlobalSearchSkeletonLoading';
import { useLibraryContext } from '@components/Context/LibraryContext';
import NovelCover from '@components/NovelCover';
import { AppIcon, AppText, ComposeList, useScreenInsets } from '@components';
import { RootStackParamList } from '@navigators/types';
import {
  NovelCoverLayoutProvider,
  useNovelCoverLayout,
  useNovelCoverLayoutValue,
} from '@components/NovelCoverLayoutContext';
import ArrowForwardIcon from '@expo/material-symbols/arrow_forward.xml';

interface GlobalSearchResultsListProps {
  searchResults: GlobalSearchResult[];
  ListEmptyComponent?: React.JSX.Element;
}

const GlobalSearchResultsList: React.FC<GlobalSearchResultsListProps> = ({
  searchResults,
  ListEmptyComponent,
}) => {
  const coverLayout = useNovelCoverLayoutValue(true);
  const { bottom } = useScreenInsets();
  const keyExtractor = useCallback(
    (item: GlobalSearchResult) => item.plugin.id,
    [],
  );

  return (
    <NovelCoverLayoutProvider value={coverLayout}>
      <ComposeList
        keyExtractor={keyExtractor}
        data={searchResults}
        contentPadding={{ top: 8, bottom: bottom + 60 }}
        renderItem={item => <GlobalSearchSourceResults item={item} />}
        footer={searchResults.length ? null : ListEmptyComponent}
      />
    </NovelCoverLayoutProvider>
  );
};

const GlobalSearchSourceResults: React.FC<{ item: GlobalSearchResult }> = ({
  item,
}) => {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [inActivity, setInActivity] = useState<Record<string, boolean>>({});
  const { novelInLibrary, switchNovelToLibrary } = useLibraryContext();
  const imageRequestInit = getPlugin(item.plugin.id)?.imageRequestInit;
  const { coverWidth } = useNovelCoverLayout();

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
      <Column modifiers={[fillMaxWidth(), padding(0, 4, 0, 12)]}>
        <Row
          verticalAlignment="center"
          modifiers={[
            fillMaxWidth(),
            clickable(() =>
              navigation.navigate('SourceScreen', {
                pluginId: item.plugin.id,
                pluginName: item.plugin.name,
                site: item.plugin.site,
              }),
            ),
            padding(16, 8, 16, 8),
          ]}
        >
          <Column modifiers={[weight(1)]}>
            <AppText variant="titleSmall" maxLines={1}>
              {item.plugin.name}
            </AppText>
            <AppText
              variant="bodySmall"
              color={theme.onSurfaceVariant}
              maxLines={1}
            >
              {getLocaleLanguageName(item.plugin.lang)}
            </AppText>
          </Column>
          <AppIcon source={ArrowForwardIcon} tint={theme.onSurface} />
        </Row>
        {item.isLoading ? (
          <GlobalSearchSkeletonLoading theme={theme} />
        ) : item.error ? (
          <AppText
            variant="bodyMedium"
            color={theme.error}
            maxLines={3}
            modifiers={[padding(16, 0, 16, 8)]}
          >
            {item.error}
          </AppText>
        ) : !item.novels.length ? (
          <AppText
            variant="bodyMedium"
            color={theme.onSurfaceVariant}
            modifiers={[padding(16, 0, 16, 8)]}
          >
            {getString('sourceScreen.noResultsFound')}
          </AppText>
        ) : (
          <LazyRow
            horizontalArrangement={{ spacedBy: 12 }}
            contentPadding={{ start: 16, end: 16 }}
            modifiers={[fillMaxWidth()]}
          >
            {item.novels.map(novelItem => {
              const inLibrary = novelInLibrary(item.plugin.id, novelItem.path);

              return (
                <Box
                  key={item.plugin.id + '_' + novelItem.path}
                  modifiers={[width(coverWidth)]}
                >
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
                    hasSelection={false}
                    isSelected={false}
                    imageRequestInit={imageRequestInit}
                    theme={theme}
                  />
                </Box>
              );
            })}
          </LazyRow>
        )}
      </Column>
    ),
    [
      coverWidth,
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
      novelInLibrary,
      switchNovelToLibrary,
      theme,
    ],
  );
};

export default GlobalSearchResultsList;
