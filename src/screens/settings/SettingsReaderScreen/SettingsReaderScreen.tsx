import { View, StyleSheet, useWindowDimensions } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import { FAB } from 'react-native-paper';

import { Appbar, SafeAreaView } from '@components/index';
import BottomSheet from '@components/BottomSheet/BottomSheet';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';

import TabBar, { Tab } from './components/TabBar';
import DisplayTab from './tabs/DisplayTab';
import ThemeTab from './tabs/ThemeTab';
import NavigationTab from './tabs/NavigationTab';
import AccessibilityTab from './tabs/AccessibilityTab';
import SettingsReaderWebView from './components/SettingsReaderWebView';

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
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { bottom, right } = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<string>('display');

  const tabs: Tab[] = [
    { id: 'display', label: 'Display', icon: 'format-size' },
    { id: 'theme', label: 'Theme', icon: 'palette-outline' },
    { id: 'navigation', label: 'Navigation', icon: 'gesture-swipe-horizontal' },
    { id: 'accessibility', label: 'Accessibility', icon: 'account-voice' },
  ];

  const readerSettings = useChapterReaderSettings();
  const BOTTOM_SHEET_HEIGHT = screenHeight * 0.7;

  const readerBackgroundColor = readerSettings.theme;

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const openBottomSheet = () => {
    bottomSheetRef.current?.present();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'display':
        return <DisplayTab />;
      case 'theme':
        return <ThemeTab />;
      case 'navigation':
        return <NavigationTab />;
      case 'accessibility':
        return <AccessibilityTab />;
      default:
        return <DisplayTab />;
    }
  };

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
        enablePanDownToClose={true}
      >
        <View
          style={[
            styles.bottomSheetContent,
            { backgroundColor: theme.surface },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: theme.onSurfaceVariant },
              ]}
            />
          </View>

          {/* Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            theme={theme}
          />

          {/* Tab Content */}
          <View style={styles.tabContent}>{renderTabContent()}</View>
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
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  tabContent: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
  },
});
