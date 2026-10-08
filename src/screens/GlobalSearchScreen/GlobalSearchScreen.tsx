import { useCallback, useMemo, useState } from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  imePadding,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import { getStringAsync } from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';

import {
  EmptyView,
  Fab,
  ProgressIndicator,
  Screen,
  SearchbarV2,
  SelectableChip,
} from '@components/index';
import GlobalSearchResultsList from './components/GlobalSearchResultsList';

import { useSearch } from '@hooks';
import { useTheme } from '@hooks/persisted';

import { getString } from '@i18n/translations';
import { navigationRef } from '@navigators/ShareIntentHandler';
import { resolveSharedUrl } from '@services/share/resolveSharedUrl';
import { showToast } from '@utils/showToast';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import ContentPasteIcon from '@expo/material-symbols/content_paste.xml';
import FilterListIcon from '@expo/material-symbols/filter_list.xml';
import MenuBookIcon from '@expo/material-symbols/menu_book.xml';
import SearchIcon from '@expo/material-symbols/search.xml';

interface Props {
  route?: {
    params?: {
      searchText?: string;
    };
  };
}

const GlobalSearchScreen = (props: Props) => {
  const theme = useTheme();
  const { searchText, setSearchText, clearSearchbar } = useSearch(
    props?.route?.params?.searchText,
    false,
  );
  const onChangeText = (text: string) => setSearchText(text);

  const [hasResultsOnly, setHasResultsOnly] = useState(false);
  const [clipboardNovel, setClipboardNovel] = useState<
    { pluginId: string; path: string } | undefined
  >();

  // Only a URL matching an installed source is offered from the clipboard.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getStringAsync()
        .then(text => {
          const result = text ? resolveSharedUrl(text) : undefined;
          if (active) {
            setClipboardNovel(
              result?.kind === 'novel'
                ? { pluginId: result.pluginId, path: result.path }
                : undefined,
            );
          }
        })
        .catch(() => {
          // Clipboard unreadable — nothing to offer.
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const { searchResults, progress } = useGlobalSearch({
    defaultSearchText: searchText,
    hasResultsOnly,
  });

  const searchUrlResult = useMemo(
    () => resolveSharedUrl(searchText),
    [searchText],
  );

  const openNovel = useCallback((novel: { pluginId: string; path: string }) => {
    navigationRef.navigate('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        path: novel.path,
        pluginId: novel.pluginId,
        cover: null,
      },
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (searchUrlResult?.kind === 'novel') {
      openNovel(searchUrlResult);
    } else if (searchUrlResult) {
      // Valid URL but no matching installed source.
      showToast(getString('globalSearch.noSourceForUrl'));
    }
    // Non-URL text: the debounced search is already running; enter does nothing extra.
  }, [openNovel, searchUrlResult]);

  const openNovelOffer =
    searchUrlResult?.kind === 'novel'
      ? {
          icon: MenuBookIcon,
          label: getString('globalSearch.openNovel'),
          onPress: handleSubmit,
        }
      : searchText === '' && clipboardNovel
      ? {
          icon: ContentPasteIcon,
          label: getString('globalSearch.openCopiedNovel'),
          onPress: () => openNovel(clipboardNovel),
        }
      : null;

  return (
    <Screen
      topBar={
        <Column modifiers={[fillMaxWidth()]}>
          <SearchbarV2
            searchText={searchText}
            placeholder={getString('browseScreen.globalSearch')}
            leftIcon={SearchIcon}
            onChangeText={onChangeText}
            onSubmitEditing={handleSubmit}
            clearSearchbar={clearSearchbar}
            theme={theme}
          />
          {progress ? (
            <ProgressIndicator
              progress={Math.round(1000 * progress) / 1000}
              modifiers={[fillMaxWidth()]}
            />
          ) : null}
          {progress > 0 ? (
            <Row modifiers={[fillMaxWidth(), padding(8, 16, 8, 0)]}>
              <SelectableChip
                label="Has results"
                selected={hasResultsOnly}
                icon={FilterListIcon}
                showCheckIcon={false}
                theme={theme}
                onPress={() => setHasResultsOnly(!hasResultsOnly)}
                mode="outlined"
              />
            </Row>
          ) : null}
        </Column>
      }
      list={
        <GlobalSearchResultsList
          searchResults={searchResults}
          ListEmptyComponent={
            <EmptyView
              icon="__φ(．．)"
              description={`${getString('globalSearch.searchIn')} ${getString(
                'globalSearch.allSources',
              )}`}
              theme={theme}
            />
          }
        />
      }
      floatingAction={
        openNovelOffer ? (
          // Edge-to-edge: the IME overlays the screen, so the FAB must float above it.
          <Box modifiers={[imePadding()]}>
            <Fab
              extended
              icon={openNovelOffer.icon}
              label={openNovelOffer.label}
              onPress={openNovelOffer.onPress}
            />
          </Box>
        ) : undefined
      }
    />
  );
};

export default GlobalSearchScreen;
