import React, { RefObject } from 'react';
import { Share, StyleSheet } from 'react-native';
import { Box } from '@expo/ui/jetpack-compose';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';

import { AppHost, Menu as DropdownMenu } from '@components';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import { showToast } from '@utils/showToast';

interface MenuProps {
  theme: ThemeColors;
  currentUrl: string;
  webView: RefObject<WebView<object> | null>;
  setMenuVisible: (value: boolean) => void;
}

const Menu: React.FC<MenuProps> = ({ currentUrl, webView, setMenuVisible }) => {
  const { top } = useSafeAreaInsets();

  return (
    <AppHost matchContents style={[styles.menuContainer, { top: top + 56 }]}>
      <DropdownMenu
        visible
        onDismiss={() => setMenuVisible(false)}
        anchor={<Box />}
      >
        <DropdownMenu.Item
          onPress={() => {
            setMenuVisible(false);
            webView.current?.reload();
          }}
          title={getString('webview.refresh')}
        />
        <DropdownMenu.Item
          onPress={() => {
            setMenuVisible(false);
            Share.share({ message: currentUrl });
          }}
          title={getString('webview.share')}
        />
        <DropdownMenu.Item
          onPress={() => {
            setMenuVisible(false);
            Linking.openURL(currentUrl);
          }}
          title={getString('webview.openInBrowser')}
        />
        <DropdownMenu.Item
          onPress={() => {
            setMenuVisible(false);
            webView.current?.clearCache?.(true);
            webView.current?.reload();
            showToast(getString('webview.dataDeleted'));
          }}
          title={getString('webview.clearData')}
        />
      </DropdownMenu>
    </AppHost>
  );
};

export default Menu;

const styles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    right: 8,
  },
});
