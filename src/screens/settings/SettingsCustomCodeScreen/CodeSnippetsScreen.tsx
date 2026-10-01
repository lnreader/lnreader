import React from 'react';
import { Appbar, IconButtonV2, Screen, TabPager } from '@components';
import FileOpenIcon from '@expo/material-symbols/file_open.xml';
import SaveIcon from '@expo/material-symbols/save.xml';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import SnippetEditor, { SnippetEditorHandle } from './SnippetEditor';
import SettingsReaderWebView from '../SettingsReaderScreen/components/SettingsReaderWebView';
import { CodeSnippetsScreenProps } from '@navigators/types';
import NativeFile from '@modules/native-file';
import * as DocumentPicker from 'expo-document-picker';
import { useKeyboardHeight } from '@hooks/common/useKeyboardHeight';

const routes = [
  { key: 'code', title: getString('common.code') },
  { key: 'example', title: getString('common.example') },
];

const CodeSnippetsScreen: React.FC<CodeSnippetsScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const snippetIndex = route?.params?.snippetIndex;
  const isJS = route?.params?.isJS;
  const language = isJS === false ? 'css' : 'js';
  const { codeSnippetsCSS, codeSnippetsJS } = useChapterReaderSettings();
  const snippetName =
    snippetIndex !== undefined && snippetIndex >= 0
      ? (language === 'css' ? codeSnippetsCSS : codeSnippetsJS)[snippetIndex]
          ?.name ?? ''
      : '';

  const [index, setIndex] = React.useState(0);
  const [exampleCode, setExampleCode] = React.useState<string>();
  const editorRef = React.useRef<SnippetEditorHandle>(null);
  // Drags in the editor move the cursor and selection, not the page.
  const editing = useKeyboardHeight() > 0;

  const renderScene = ({ route: r }: { route: (typeof routes)[number] }) => {
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
    <Screen
      topBar={
        <Appbar
          title={snippetName}
          handleGoBack={() => navigation.goBack()}
          theme={theme}
          mode="small"
        >
          <IconButtonV2
            accessibilityLabel={getString('customCodeSettings.importCode')}
            name={FileOpenIcon}
            size={24}
            onPress={handleImport}
            theme={theme}
          />
          <IconButtonV2
            accessibilityLabel={getString('common.save')}
            name={SaveIcon}
            size={24}
            onPress={() => editorRef.current?.save()}
            theme={theme}
          />
        </Appbar>
      }
      list={
        <TabPager
          tabs={routes.map((r, i) => ({ key: i, label: r.title }))}
          index={index}
          onIndexChange={i => {
            if (routes[i]?.key === 'example') {
              setExampleCode(editorRef.current?.getCode());
            }
            setIndex(i);
          }}
          renderPage={i => renderScene({ route: routes[i] })}
          swipeEnabled={!editing}
          fixed
        />
      }
    />
  );
};

export default CodeSnippetsScreen;
