import React, { RefObject } from 'react';
import { StyleSheet } from 'react-native';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  defaultMinSize,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHost, AppText, IconButtonV2 } from '@components';
import { ThemeColors } from '@theme/types';
import WebView from 'react-native-webview';
import ArrowBackIcon from '@expo/material-symbols/arrow_back.xml';
import ArrowForwardIcon from '@expo/material-symbols/arrow_forward.xml';
import CloseIcon from '@expo/material-symbols/close.xml';
import MoreVertIcon from '@expo/material-symbols/more_vert.xml';

interface AppbarProps {
  title: string;
  currentUrl: string;
  theme: ThemeColors;
  canGoBack: boolean;
  canGoForward: boolean;
  webView: RefObject<WebView<object> | null>;
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
    <AppHost matchContents={{ vertical: true }} style={styles.container}>
      <Row
        verticalAlignment="center"
        modifiers={[
          fillMaxWidth(),
          background(theme.surface),
          padding(4, top, 4, 0),
          defaultMinSize({ minHeight: 64 + top }),
        ]}
      >
        <IconButtonV2
          name={CloseIcon}
          color={theme.onSurface}
          onPress={goBack}
          theme={theme}
        />
        <Column modifiers={[weight(1), padding(8, 0, 8, 0)]}>
          <AppText variant="titleMedium" maxLines={1} color={theme.onSurface}>
            {title}
          </AppText>
          <AppText
            variant="bodySmall"
            maxLines={1}
            color={theme.onSurfaceVariant}
          >
            {currentUrl}
          </AppText>
        </Column>
        <Row modifiers={[padding(4, 0, 0, 0)]}>
          <IconButtonV2
            name={ArrowBackIcon}
            color={theme.onSurface}
            disabled={!canGoBack}
            onPress={() => webView.current?.goBack()}
            theme={theme}
          />
          <IconButtonV2
            name={ArrowForwardIcon}
            color={theme.onSurface}
            disabled={!canGoForward}
            onPress={() => webView.current?.goForward()}
            theme={theme}
          />
          <IconButtonV2
            name={MoreVertIcon}
            color={theme.onSurface}
            onPress={() => setMenuVisible(true)}
            theme={theme}
          />
        </Row>
      </Row>
    </AppHost>
  );
};

export default Appbar;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
