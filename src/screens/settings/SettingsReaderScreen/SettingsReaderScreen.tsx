import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { FAB } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { type TabBarProps, type TabDescriptor } from 'react-native-tab-view';

import { Appbar, SafeAreaView, TopTabBar } from '@components/index';
import SheetTabView from '@components/BottomSheet/SheetTabView';
import BottomSheet, {
  BottomSheetRef,
  useTabScrollables,
} from '@components/BottomSheet/BottomSheet';
import {
  useAppSettings,
  useChapterReaderSettings,
  useTheme,
} from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SettingsReaderWebView from './components/SettingsReaderWebView';
import DisplayTab from './tabs/DisplayTab';
import ThemeTab from './tabs/ThemeTab';
import NavigationTab from './tabs/NavigationTab';
import AccessibilityTab from './tabs/AccessibilityTab';

type ReaderSettingsRoute = {
  key: 'display' | 'theme' | 'navigation' | 'accessibility';
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const routes: ReaderSettingsRoute[] = [
  { key: 'display', title: 'Display', icon: 'format-size' },
  { key: 'theme', title: 'Theme', icon: 'palette-outline' },
  { key: 'navigation', title: 'Navigation', icon: 'gesture-swipe-horizontal' },
  { key: 'accessibility', title: 'Accessibility', icon: 'account-voice' },
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

const SettingsReaderScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const { bottom, right } = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [tabIndex, setTabIndex] = useState(0);

  const { reduceAppAnimations = false } = useAppSettings();
  const readerSettings = useChapterReaderSettings();
  const BOTTOM_SHEET_HEIGHT = screenHeight * 0.7;
  const readerBackgroundColor = readerSettings.theme;

  const openBottomSheet = () => {
    bottomSheetRef.current?.present();
  };

  const { register, scrollableRef } = useTabScrollables(routes[tabIndex].key);

  const renderTabContent = useCallback(
    ({ route }: { route: ReaderSettingsRoute }) => {
      const scrollRef = register(route.key);
      switch (route.key) {
        case 'theme':
          return <ThemeTab scrollRef={scrollRef} />;
        case 'navigation':
          return <NavigationTab scrollRef={scrollRef} />;
        case 'accessibility':
          return <AccessibilityTab scrollRef={scrollRef} />;
        default:
          return <DisplayTab scrollRef={scrollRef} />;
      }
    },
    [register],
  );

  const renderTabBar = useCallback(
    (props: TabBarProps<ReaderSettingsRoute>) => (
      <TopTabBar
        {...props}
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.surfaceContainerLow ?? theme.surface,
            borderBottomColor: theme.outlineVariant,
          },
        ]}
        indicatorStyle={{ backgroundColor: theme.primary }}
        activeColor={theme.primary}
        inactiveColor={theme.onSurfaceVariant}
        android_ripple={{ color: theme.rippleColor, borderless: false }}
      />
    ),
    [
      theme.outlineVariant,
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
        <SettingsReaderWebView />
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
        scrollableRef={scrollableRef}
      >
        <View style={styles.bottomSheetContent}>
          <SheetTabView
            commonOptions={tabOptions}
            navigationState={{ index: tabIndex, routes }}
            renderTabBar={renderTabBar}
            renderScene={renderTabContent}
            onIndexChange={setTabIndex}
            initialLayout={{ width: screenWidth }}
            lazy
            animationEnabled={!reduceAppAnimations}
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
  tabBar: {
    borderBottomWidth: 1,
    elevation: 0,
  },
});
