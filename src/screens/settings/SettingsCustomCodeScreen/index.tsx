import { SafeAreaView } from '@components';
import { CustomCodeSettingsScreenProps } from '@navigators/types';
import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  NavigationState,
  SceneRendererProps,
  TabBar,
  TabView,
} from 'react-native-tab-view';
import SettingsRoute from './Routes/SettingsRoute';
import Color from 'color';
import CodeRoute from './Routes/CodeRoute';
import SelfHidingAppBar from './Components/SelfHidingAppbar';
import { useSharedValue } from 'react-native-reanimated';
import { useTheme } from '@hooks/persisted';
import SettingsWebView from './Components/SettingsWebView';

const routes = [
  { key: 'first', title: 'Settings' },
  { key: 'second', title: 'Code' },
  { key: 'third', title: 'Example' },
];

type State = NavigationState<{
  key: string;
  title: string;
}>;

const SettingsCustomCode = ({ navigation }: CustomCodeSettingsScreenProps) => {
  const theme = useTheme();
  const [index, setIndex] = React.useState(0);
  const layout = useWindowDimensions();

  // 0 = visible, 1 = hidden. Using a number is flexible.
  const appBarHiddenState = useSharedValue(0);

  // State for editing snippets
  const [editingSnippet, setEditingSnippet] = React.useState<{
    index: number;
    isJS: boolean;
  } | null>(null);

  const handleTabChange = (newIndex: number) => {
    appBarHiddenState.value = newIndex ? 1 : 0;
    setIndex(newIndex);
    // Clear editing state when manually switching tabs
    if (newIndex !== 1) {
      setEditingSnippet(null);
    }
  };

  const handleEditSnippet = (snippetIndex: number, isJS: boolean) => {
    appBarHiddenState.value = 1;
    setEditingSnippet({
      index: snippetIndex,
      isJS: snippetIndex === -1 ? true : isJS, // Default to JS for new snippets, use passed value for editing
    });
    setIndex(1); // Switch to Code tab
  };

  const handleSnippetSaved = () => {
    setEditingSnippet(null);
    setIndex(0); // Switch back to Settings tab
  };

  const renderScene = ({
    route,
    jumpTo,
  }: SceneRendererProps & {
    route: {
      key: string;
      title: string;
    };
  }) => {
    switch (route.key) {
      case 'first':
        return <SettingsRoute onEditSnippet={handleEditSnippet} />;
      case 'second':
        return (
          <CodeRoute
            jumpTo={jumpTo}
            editingSnippet={editingSnippet}
            onSnippetSaved={handleSnippetSaved}
          />
        );
      case 'third':
        return <SettingsWebView />;
      default:
        return null;
    }
  };

  const renderTabBar = React.useCallback(
    (props: SceneRendererProps & { navigationState: State }) => {
      return (
        <TabBar
          {...props}
          indicatorStyle={[
            styles.tabBarIndicator,
            { backgroundColor: theme.primary },
          ]}
          style={[
            {
              backgroundColor: theme.surface,
              borderBottomColor: Color(theme.isDark ? '#FFFFFF' : '#000000')
                .alpha(0.12)
                .string(),
            },
            styles.tabBar,
          ]}
          tabStyle={styles.flex}
          gap={8}
          inactiveColor={theme.secondary}
          activeColor={theme.primary}
          android_ripple={{ color: theme.rippleColor, foreground: true }}
        />
      );
    },
    [
      theme.isDark,
      theme.primary,
      theme.rippleColor,
      theme.secondary,
      theme.surface,
    ],
  );
  return (
    <SafeAreaView excludeTop>
      <SelfHidingAppBar
        title={'Custom Code'}
        handleGoBack={() => navigation.goBack()}
        theme={theme}
        hiddenState={appBarHiddenState}
      />

      <TabView
        collapsable={false}
        lazy
        navigationState={{ index, routes }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={handleTabChange}
        initialLayout={{ width: layout.width }}
      />
    </SafeAreaView>
  );
};

export default SettingsCustomCode;

const styles = StyleSheet.create({
  tabBar: {
    borderBottomWidth: 1,
    elevation: 0,
  },
  tabBarIndicator: {
    height: 3,
  },
  flex: {
    flex: 1,
  },
});
