import React from 'react';
import {
  NavigationState,
  SceneRendererProps,
  TabBar,
  TabView,
} from 'react-native-tab-view';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Color from 'color';

import { Appbar, IconButtonV2, SafeAreaView } from '@components';
import { useTheme } from '@hooks/persisted';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import SnippetEditor, { SnippetEditorHandle } from './SnippetEditor';
import SettingsReaderWebView from '../SettingsReaderScreen/components/SettingsReaderWebView';
import { CodeSnippetsScreenProps } from '@navigators/types';
import NativeFile from '@modules/native-file';
import * as DocumentPicker from 'expo-document-picker';

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
  const snippetIndex = route?.params?.snippetIndex;
  const isJS = route?.params?.isJS;
  const language = isJS === false ? 'css' : 'js';
  const theme = useTheme();
  const layout = useWindowDimensions();

  const [index, setIndex] = React.useState(0);
  const [exampleCode, setExampleCode] = React.useState<string>();
  const editorRef = React.useRef<SnippetEditorHandle>(null);

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
            ref={editorRef}
            snippetIndex={snippetIndex}
            language={language}
          />
        );
      case 'example':
        return (
          <SettingsReaderWebView
            customCSS={isJS === false ? exampleCode : undefined}
            customJS={isJS === false ? undefined : exampleCode}
          />
        );
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

  const handleImport = async () => {
    try {
      const mimeType =
        language === 'css' ? 'text/css' : 'application/javascript';
      const file = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
        type: mimeType,
      });

      if (file.assets) {
        const tempPath =
          NativeFile.ExternalCachesDirectoryPath +
          '/imported_custom.' +
          language;
        await NativeFile.copyFile(file.assets[0].uri, tempPath);
        const content = await NativeFile.readFile(tempPath);
        await NativeFile.unlink(tempPath);

        editorRef.current?.setCode(content.trim());
        showToast(getString('customCodeSettings.imported'));
      }
    } catch (error: any) {
      showToast(error.message);
    }
  };

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title=""
        handleGoBack={() => navigation.goBack()}
        theme={theme}
        mode="small"
      >
        <IconButtonV2
          name="file-import-outline"
          size={24}
          onPress={handleImport}
          theme={theme}
        />
        <IconButtonV2
          name="content-save"
          size={24}
          onPress={() => editorRef.current?.save()}
          theme={theme}
        />
      </Appbar>
      <TabView
        collapsable={false}
        lazy
        navigationState={{ index, routes }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={i => {
          if (routes[i]?.key === 'example') {
            setExampleCode(editorRef.current?.getCode());
          }
          setIndex(i);
        }}
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
    marginBottom: -8,
  },
  tabBarIndicator: {
    height: 3,
  },
  flex: {
    flex: 1,
  },
});
