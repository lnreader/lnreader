import React, { RefObject } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButtonV2 } from '@components';
import { ThemeColors } from '@theme/types';
import WebView from 'react-native-webview';

interface AppbarProps {
  title: string;
  currentUrl: string;
  theme: ThemeColors;
  canGoBack: boolean;
  canGoForward: boolean;
  webView: RefObject<WebView | null>;
  setMenuVisible: (value: boolean) => void;
  goBack: () => void;
}

const Appbar: React.FC<AppbarProps> = ({
  title,
  currentUrl,
  theme,
  canGoBack,
  canGoForward,
  webView,
  setMenuVisible,
  goBack,
}) => {
  const { top } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top, backgroundColor: theme.surface },
      ]}
    >
      <IconButtonV2
        name="close"
        color={theme.onSurface}
        onPress={goBack}
        theme={theme}
      />
      <View style={styles.titleContainer}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: theme.onSurface }]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.url, { color: theme.onSurfaceVariant }]}
        >
          {currentUrl}
        </Text>
      </View>
      <View style={styles.iconContainer}>
        <IconButtonV2
          name="arrow-left"
          color={theme.onSurface}
          disabled={!canGoBack}
          onPress={() => webView.current?.goBack()}
          theme={theme}
        />

        <IconButtonV2
          name="arrow-right"
          color={theme.onSurface}
          disabled={!canGoForward}
          onPress={() => webView.current?.goForward()}
          theme={theme}
        />

        <IconButtonV2
          name="dots-vertical"
          color={theme.onSurface}
          onPress={() => setMenuVisible(true)}
          theme={theme}
        />
      </View>
    </View>
  );
};

export default Appbar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  iconContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 18,
    paddingBottom: 2,
    paddingLeft: 2,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  url: {
    fontSize: 12,
    paddingLeft: 2,
  },
});
