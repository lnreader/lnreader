import { View, StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useNavigation } from '@react-navigation/native';
import WebView from 'react-native-webview';
import { FAB } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import {
  TabView,
  type TabBarProps,
  type TabDescriptor,
} from 'react-native-tab-view';
import { dummyHTML } from './utils';

import { Appbar, SafeAreaView, TopTabBar } from '@components/index';
import BottomSheet from '@components/BottomSheet/BottomSheet';

import {
  useChapterGeneralSettings,
  useChapterReaderSettings,
  useTheme,
} from '@hooks/persisted';
import { getString } from '@i18n/translations';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import color from 'color';
import { useBatteryLevel } from 'react-native-device-info';
import * as Speech from 'expo-speech';

import DisplayTab from './tabs/DisplayTab';
import ThemeTab from './tabs/ThemeTab';
import NavigationTab from './tabs/NavigationTab';
import AccessibilityTab from './tabs/AccessibilityTab';
import AdvancedTab from './tabs/AdvancedTab';

type ReaderSettingsRoute = {
  key: 'display' | 'theme' | 'navigation' | 'accessibility' | 'advanced';
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const routes: ReaderSettingsRoute[] = [
  { key: 'display', title: 'Display', icon: 'format-size' },
  { key: 'theme', title: 'Theme', icon: 'palette-outline' },
  {
    key: 'navigation',
    title: 'Navigation',
    icon: 'gesture-swipe-horizontal',
  },
  {
    key: 'accessibility',
    title: 'Accessibility',
    icon: 'account-voice',
  },
  { key: 'advanced', title: 'Advanced', icon: 'code-braces' },
];

const tabOptions: TabDescriptor<ReaderSettingsRoute> = {
  icon: ({ route, color: iconColor }) => (
    <MaterialCommunityIcons name={route.icon} size={20} color={iconColor} />
  ),
  label: () => null,
};

export type TextAlignments =
  | 'left'
  | 'center'
  | 'auto'
  | 'right'
  | 'justify'
  | undefined;

type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number };
};

const SettingsReaderScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const webViewRef = useRef<WebView>(null);
  const bottomSheetRef = useRef<BottomSheetModalMethods>(null);
  const { bottom, right } = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [tabIndex, setTabIndex] = useState(0);

  const novel = {
    'artist': null,
    'author': 'LNReader-kun',
    'cover':
      'file:///storage/emulated/0/Android/data/com.rajarsheechatterjee.LNReader/files/Novels/lightnovelcave/16/cover.png?1717862123181',
    'genres': 'Action,Hero',
    'id': 16,
    'inLibrary': 1,
    'isLocal': 0,
    'name': 'Preview Man (LN)',
    'path': 'novel/preview-man-16091321',
    'pluginId': 'lightnovelcave',
    'status': 'Ongoing',
    'summary':
      'To preview or not preview. A question that bothered humanity for a long time, until one day… Preview Man appeared.Show More',
    'totalPages': 8,
  };
  const chapter = {
    'bookmark': 0,
    'chapterNumber': 1,
    'id': 3722,
    'isDownloaded': 1,
    'name': 'Chapter 1 - The rise of Preview Man',
    'novelId': 16,
    'page': '2',
    'path': 'novel/preview-man/chapter-1',
    'position': 0,
    'progress': 3,
    'readTime': '2100-01-01 00:00:00',
    'releaseTime': 'January 1, 2100',
    'unread': 1,
    'updatedTime': null,
  };
  const [hidden, setHidden] = useState(true);
  const batteryLevel = useBatteryLevel();
  const readerSettings = useChapterReaderSettings();
  const chapterGeneralSettings = useChapterGeneralSettings();

  const BOTTOM_SHEET_HEIGHT = screenHeight * 0.7;
  const assetsUriPrefix = useMemo(
    () => (__DEV__ ? 'http://localhost:8081/assets' : 'file:///android_asset'),
    [],
  );
  const webViewCSS = `
  <link rel="stylesheet" href="${assetsUriPrefix}/css/index.css">
    <style>
    :root {
      --StatusBar-currentHeight: ${StatusBar.currentHeight};
      --readerSettings-theme: ${readerSettings.theme};
      --readerSettings-padding: ${readerSettings.padding}px;
      --readerSettings-textSize: ${readerSettings.textSize}px;
      --readerSettings-textColor: ${readerSettings.textColor};
      --readerSettings-textAlign: ${readerSettings.textAlign};
      --readerSettings-lineHeight: ${readerSettings.lineHeight};
      --readerSettings-fontFamily: ${readerSettings.fontFamily};
      --theme-primary: ${theme.primary};
      --theme-onPrimary: ${theme.onPrimary};
      --theme-secondary: ${theme.secondary};
      --theme-tertiary: ${theme.tertiary};
      --theme-onTertiary: ${theme.onTertiary};
      --theme-onSecondary: ${theme.onSecondary};
      --theme-surface: ${theme.surface};
      --theme-surface-0-9: ${color(theme.surface).alpha(0.9).toString()};
      --theme-onSurface: ${theme.onSurface};
      --theme-surfaceVariant: ${theme.surfaceVariant};
      --theme-onSurfaceVariant: ${theme.onSurfaceVariant};
      --theme-outline: ${theme.outline};
      --theme-rippleColor: ${theme.rippleColor};
      }
      
      @font-face {
        font-family: ${readerSettings.fontFamily};
        src: url("file:///android_asset/fonts/${
          readerSettings.fontFamily
        }.ttf");
      }
    </style>

    <style>${readerSettings.customCSS}</style>
  `;

  const readerBackgroundColor = readerSettings.theme;

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const openBottomSheet = () => {
    bottomSheetRef.current?.present();
  };

  const renderTabContent = useCallback(
    ({ route }: { route: ReaderSettingsRoute }) => {
      switch (route.key) {
        case 'display':
          return <DisplayTab />;
        case 'theme':
          return <ThemeTab />;
        case 'navigation':
          return <NavigationTab />;
        case 'accessibility':
          return <AccessibilityTab />;
        case 'advanced':
          return <AdvancedTab />;
        default:
          return <DisplayTab />;
      }
    },
    [],
  );

  const tabBarBorderColor = useMemo(
    () =>
      color(theme.isDark ? '#FFFFFF' : '#000000')
        .alpha(0.12)
        .string(),
    [theme.isDark],
  );

  const renderTabBar = useCallback(
    (props: TabBarProps<ReaderSettingsRoute>) => (
      <TopTabBar
        {...props}
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.surfaceContainerLow ?? theme.surface,
            borderBottomColor: tabBarBorderColor,
          },
        ]}
        indicatorStyle={{ backgroundColor: theme.primary }}
        activeColor={theme.primary}
        inactiveColor={theme.onSurfaceVariant}
        android_ripple={{ color: theme.rippleColor, borderless: false }}
      />
    ),
    [
      tabBarBorderColor,
      theme.onSurfaceVariant,
      theme.primary,
      theme.rippleColor,
      theme.surface,
      theme.surfaceContainerLow,
    ],
  );

  return (
    <SafeAreaView
      excludeTop
      style={[styles.container, { backgroundColor: readerBackgroundColor }]}
    >
      <Appbar
        mode="small"
        title={getString('readerSettings.title')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />

      {/* Large Preview Area */}
      <View style={styles.previewContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          allowFileAccess={true}
          scalesPageToFit={true}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled={true}
          style={[styles.webView, { backgroundColor: readerBackgroundColor }]}
          nestedScrollEnabled={true}
          onMessage={(ev: { nativeEvent: { data: string } }) => {
            const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);
            switch (event.type) {
              case 'hide':
                if (hidden) {
                  webViewRef.current?.injectJavaScript(
                    'reader.hidden.val = true',
                  );
                } else {
                  webViewRef.current?.injectJavaScript(
                    'reader.hidden.val = false',
                  );
                }
                setHidden(!hidden);
                break;
              case 'speak':
                if (event.data && typeof event.data === 'string') {
                  Speech.speak(event.data, {
                    onDone() {
                      webViewRef.current?.injectJavaScript('tts.next?.()');
                    },
                    voice: readerSettings.tts?.voice?.identifier,
                    pitch: readerSettings.tts?.pitch || 1,
                    rate: readerSettings.tts?.rate || 1,
                  });
                } else {
                  webViewRef.current?.injectJavaScript('tts.next?.()');
                }
                break;
              case 'stop-speak':
                Speech.stop();
                break;
            }
          }}
          source={{
            html: `
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                ${webViewCSS}
              </head>
              <body class="${
                chapterGeneralSettings.pageReader ? 'page-reader' : ''
              }"> 
                <div id="LNReader-chapter">
                ${dummyHTML}
                </div>
                <div id="reader-ui"></div>
              </body>
              <script>
                var initialReaderConfig = ${JSON.stringify({
                  readerSettings,
                  chapterGeneralSettings,
                  novel,
                  chapter,
                  nextChapter: chapter,
                  batteryLevel,
                  autoSaveInterval: 2222,
                  DEBUG: __DEV__,
                  strings: {
                    finished: `${getString(
                      'readerScreen.finished',
                    )}: ${chapter.name.trim()}`,
                    nextChapter: getString('readerScreen.nextChapter', {
                      name: chapter.name,
                    }),
                    noNextChapter: getString('readerScreen.noNextChapter'),
                  },
                })}
              </script>
              <script src="${assetsUriPrefix}/js/icons.js"></script>
              <script src="${assetsUriPrefix}/js/van.js"></script>
              <script src="${assetsUriPrefix}/js/text-vibe.js"></script>
              <script src="${assetsUriPrefix}/js/core.js"></script>
              <script src="${assetsUriPrefix}/js/index.js"></script>
              <script>
                ${readerSettings.customJS}
              </script>
            </html>
            `,
          }}
        />
      </View>

      {/* Floating Action Button to Open Bottom Sheet */}
      <FAB
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            bottom,
            right,
          },
        ]}
        icon="cog"
        color={theme.onPrimary}
        onPress={openBottomSheet}
      />

      {/* Bottom Sheet with Tabs */}
      <BottomSheet
        bottomSheetRef={bottomSheetRef}
        snapPoints={[BOTTOM_SHEET_HEIGHT]}
      >
        <View style={styles.bottomSheetContent}>
          <TabView
            commonOptions={tabOptions}
            navigationState={{ index: tabIndex, routes }}
            renderTabBar={renderTabBar}
            renderScene={renderTabContent}
            onIndexChange={setTabIndex}
            initialLayout={{ width: screenWidth }}
            lazy
            lazyPreloadDistance={0}
            swipeEnabled={false}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
};

export default SettingsReaderScreen;

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    margin: 16,
  },
  bottomSheetContent: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  tabBar: {
    borderBottomWidth: 1,
    elevation: 0,
  },
});
