import React, { RefObject, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButtonV2 } from '@components';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import WebView from 'react-native-webview';

interface AppbarProps {
  title: string;
  currentUrl: string;
  theme: ThemeColors;
  canGoBack: boolean;
  canGoForward: boolean;
  webView: RefObject<WebView<object> | null>;
  setMenuVisible: (value: boolean) => void;
  goBack: () => void;
  navigateTo: (url: string) => void;
}

/**
 * Turns whatever was typed into something the WebView can load. Anything that
 * already carries a scheme is left alone, everything else is assumed to be
 * https.
 */
const normalizeUrl = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const Appbar: React.FC<AppbarProps> = ({
  title,
  currentUrl,
  theme,
  canGoBack,
  canGoForward,
  webView,
  setMenuVisible,
  goBack,
  navigateTo,
}) => {
  const { top } = useSafeAreaInsets();

  const [editing, setEditing] = useState(false);
  // Seeded when editing starts so in-page navigations can't overwrite what the
  // user is typing.
  const [draft, setDraft] = useState(currentUrl);

  const startEditing = () => {
    setDraft(currentUrl);
    setEditing(true);
  };

  const stopEditing = () => {
    setEditing(false);
    Keyboard.dismiss();
  };

  const submit = () => {
    const url = normalizeUrl(draft);
    setEditing(false);
    Keyboard.dismiss();
    if (url) {
      navigateTo(url);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top, backgroundColor: theme.surface },
      ]}
    >
      <View style={styles.appbar}>
        {editing ? (
          // `onPressIn`, because blurring the address input unmounts this
          // button before a plain `onPress` would ever fire.
          <IconButtonV2
            name="arrow-left"
            color={theme.onSurface}
            onPressIn={stopEditing}
            padding={12}
            theme={theme}
          />
        ) : (
          <IconButtonV2
            name="close"
            color={theme.onSurface}
            onPress={goBack}
            padding={12}
            theme={theme}
          />
        )}
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            onBlur={stopEditing}
            autoFocus
            selectTextOnFocus
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            keyboardType="url"
            returnKeyType="go"
            placeholder={getString('webview.enterUrl')}
            placeholderTextColor={theme.onSurfaceVariant}
            style={[
              styles.input,
              { color: theme.onSurface, backgroundColor: theme.surface2 },
            ]}
          />
        ) : (
          <Pressable style={styles.titleContainer} onPress={startEditing}>
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
          </Pressable>
        )}
        <View style={styles.iconContainer}>
          {editing ? (
            <IconButtonV2
              name="arrow-right"
              color={theme.onSurface}
              onPressIn={submit}
              padding={12}
              theme={theme}
            />
          ) : (
            <>
              <IconButtonV2
                name="arrow-left"
                color={theme.onSurface}
                disabled={!canGoBack}
                onPress={() => webView.current?.goBack()}
                padding={12}
                theme={theme}
              />
              <IconButtonV2
                name="arrow-right"
                color={theme.onSurface}
                disabled={!canGoForward}
                onPress={() => webView.current?.goForward()}
                padding={12}
                theme={theme}
              />
              <IconButtonV2
                name="dots-vertical"
                color={theme.onSurface}
                onPress={() => setMenuVisible(true)}
                padding={12}
                theme={theme}
              />
            </>
          )}
        </View>
      </View>
    </View>
  );
};

export default Appbar;

const styles = StyleSheet.create({
  appbar: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 4,
  },
  container: {
    width: '100%',
  },
  iconContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginLeft: 4,
  },
  input: {
    borderRadius: 20,
    flex: 1,
    fontSize: 16,
    marginHorizontal: 4,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
  },
  url: {
    fontSize: 12,
    lineHeight: 16,
  },
});
