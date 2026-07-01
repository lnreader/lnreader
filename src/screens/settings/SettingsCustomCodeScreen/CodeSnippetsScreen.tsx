import React from 'react';
import {
  NavigationState,
  SceneRendererProps,
  TabBar,
  TabView,
} from 'react-native-tab-view';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Color from 'color';

import { Appbar, SafeAreaView } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';
import SnippetEditor from './SnippetEditor';
import SettingsReaderWebView from '../SettingsReaderScreen/components/SettingsReaderWebView';
import { CodeSnippetsScreenProps } from '@navigators/types';

type State = NavigationState<{
  key: string;
  title: string;
}>;

const routes = [
  { key: 'code', title: getString('common.code') },
  { key: 'example', title: getString('common.example') },
];

const CodeSnippetsScreen: React.FC<CodeSnippetsScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const layout = useWindowDimensions();
  const snippetIndex = route?.params?.snippetIndex;
  const isJS = route?.params?.isJS;

  const [index, setIndex] = React.useState(0);

  const renderScene = ({
    route: r,
  }: SceneRendererProps & {
    route: {
      key: string;
      title: string;
    };
  }) => {
    switch (r.key) {
      case 'code':
        return (
          <SnippetEditor
            snippetIndex={snippetIndex}
            isJS={isJS}
            navigation={navigation}
          />
        );
      case 'example':
        return <SettingsReaderWebView />;
      default:
        return null;
    }
  };

  const renderTabBar = React.useCallback(
    (props: SceneRendererProps & { navigationState: State }) => (
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
    ),
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
      <Appbar
        title=""
        handleGoBack={() => navigation.goBack()}
        theme={theme}
        mode="small"
      />
      <TabView
        collapsable={false}
        lazy
        navigationState={{ index, routes }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
      />
    </SafeAreaView>
  );
};

export default CodeSnippetsScreen;

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
