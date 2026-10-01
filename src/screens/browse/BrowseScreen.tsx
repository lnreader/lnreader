import React, { useCallback, useMemo } from 'react';

import { useSearch } from '@hooks';
import { useInstalledPlugins, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

import { Screen, SearchbarV2, TabPager } from '@components';
import { BrowseScreenProps } from '@navigators/types';
import TravelExploreIcon from '@expo/material-symbols/travel_explore.xml';
import { PluginsTab } from './components/PluginsTab';
import { SourcesTab } from './components/SourcesTab';
import SearchIcon from '@expo/material-symbols/search.xml';

type BrowseRoute = {
  key: 'sources' | 'plugins';
  title: string;
};

const routes: BrowseRoute[] = [
  { key: 'sources', title: getString('browseScreen.sources') },
  { key: 'plugins', title: getString('browseScreen.plugins') },
];

const BrowseScreen = ({ navigation }: BrowseScreenProps) => {
  const theme = useTheme();
  const { searchText, setSearchText, clearSearchbar } = useSearch();

  const searchbarActions = useMemo(
    () =>
      [
        {
          accessibilityLabel: getString('browseScreen.globalSearch'),
          iconName: TravelExploreIcon,
          onPress: () => navigation.navigate('GlobalSearchScreen', {}),
        },
      ] as const,
    [navigation],
  );

  const menuButtons = useMemo(
    () => [
      {
        title: getString('novelScreen.migrate'),
        onPress: () => navigation.navigate('Migration'),
      },
      {
        title: getString('browseScreen.repositories'),
        onPress: () =>
          navigation.navigate('MoreStack', {
            screen: 'SettingsStack',
            params: { screen: 'RespositorySettings' },
          }),
      },
      {
        title: getString('browseSettings'),
        onPress: () => navigation.navigate('BrowseSettings'),
      },
    ],
    [navigation],
  );

  const [index, setIndex] = React.useState(0);
  const openPlugins = useCallback(() => setIndex(1), []);

  const renderScene = useCallback(
    ({ route }: { route: BrowseRoute }) => {
      switch (route.key) {
        case 'plugins':
          return (
            <PluginsTab
              navigation={navigation}
              theme={theme}
              searchText={searchText}
            />
          );
        default:
          return (
            <SourcesTab
              navigation={navigation}
              onOpenPlugins={openPlugins}
              theme={theme}
              searchText={searchText}
            />
          );
      }
    },
    [navigation, openPlugins, searchText, theme],
  );

  const pluginUpdates = useInstalledPlugins().filter(
    plugin => plugin.hasUpdate,
  ).length;

  const tabs = useMemo(
    () =>
      routes.map((route, i) => ({
        key: i,
        label: route.title,
        count:
          route.key === 'plugins' && pluginUpdates ? pluginUpdates : undefined,
      })),
    [pluginUpdates],
  );

  return (
    <Screen
      topBar={
        <SearchbarV2
          searchText={searchText}
          placeholder={getString('browseScreen.searchbar')}
          leftIcon={SearchIcon}
          onChangeText={setSearchText}
          clearSearchbar={clearSearchbar}
          theme={theme}
          rightIcons={searchbarActions}
          menuButtons={menuButtons}
        />
      }
      list={
        <TabPager
          tabs={tabs}
          index={index}
          onIndexChange={setIndex}
          renderPage={i => renderScene({ route: routes[i] })}
          showCounts
          swipeEnabled={false}
          fixed
        />
      }
    />
  );
};

export default BrowseScreen;
