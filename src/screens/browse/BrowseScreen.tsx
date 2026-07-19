import React, { useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { TabView, TabBar } from 'react-native-tab-view';
import Color from 'color';

import { useSearch } from '@hooks';
import { usePlugins, useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';

import { EmptyView, SafeAreaView, SearchbarV2 } from '@components';
import { BrowseScreenProps } from '@navigators/types';
import { AvailableTab } from './components/AvailableTab';
import { InstalledTab } from './components/InstalledTab';

const routes = [
  { key: 'installedRoute', title: getString('browseScreen.installed') },
  { key: 'availableRoute', title: getString('browseScreen.available') },
];

const BrowseScreen = ({ navigation }: BrowseScreenProps) => {
  const theme = useTheme();
  const { searchText, setSearchText, clearSearchbar } = useSearch();
  const { languagesFilter } = usePlugins();
  const layout = useWindowDimensions();

  const searchbarActions = useMemo(
    () =>
      [
        {
          iconName: 'book-search',
          onPress: () => navigation.navigate('GlobalSearchScreen', {}),
        },
        {
          iconName: 'swap-vertical-variant',
          onPress: () => navigation.navigate('Migration'),
        },
        {
          iconName: 'cog-outline',
          onPress: () => navigation.navigate('BrowseSettings'),
        },
      ] as const,
    [navigation],
  );

  useEffect(
    () =>
      navigation.addListener('tabPress', e => {
        if (navigation.isFocused()) {
          e.preventDefault();

          navigation.navigate('GlobalSearchScreen', {});
        }
      }),
    [navigation],
  );

  const [index, setIndex] = React.useState(0);
  return (
    <SafeAreaView excludeBottom>
      <SearchbarV2
        searchText={searchText}
        placeholder={getString('browseScreen.searchbar')}
        leftIcon="magnify"
        onChangeText={setSearchText}
        clearSearchbar={clearSearchbar}
        theme={theme}
        rightIcons={searchbarActions}
      />
      <TabView
        navigationState={{ index, routes }}
        initialLayout={{ width: layout.width }}
        renderScene={({ route }) => {
          if (languagesFilter.length === 0) {
            return (
              <EmptyView
                icon="(･Д･。"
                description={getString('browseScreen.listEmpty')}
                theme={theme}
              />
            );
          }
          switch (route.key) {
            case 'availableRoute':
              return <AvailableTab theme={theme} searchText={searchText} />;
            default:
              return (
                <InstalledTab
                  navigation={navigation}
                  theme={theme}
                  searchText={searchText}
                />
              );
          }
        }}
        onIndexChange={setIndex}
        renderTabBar={props => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: theme.primary, height: 3 }}
            style={{
              backgroundColor: theme.surface,
              elevation: 0,
              borderBottomWidth: 1,
              borderBottomColor: Color(theme.isDark ? '#FFFFFF' : '#000000')
                .alpha(0.12)
                .string(),
            }}
            inactiveColor={theme.secondary}
            activeColor={theme.primary}
            android_ripple={{ color: theme.rippleColor }}
          />
        )}
        swipeEnabled={false}
      />
    </SafeAreaView>
  );
};

export default BrowseScreen;
