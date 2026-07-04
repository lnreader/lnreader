import KeyboardAvoidingModal from '@components/Modal/KeyboardAvoidingModal';
import { getString } from '@strings/translations';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import CodeInput from './Components/CodeInput';
import { showToast } from '@utils/showToast';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { TextInput as PaperTextInput } from 'react-native-paper';

import { useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { IconButtonV2 } from '@components';
import type { HighlightMode } from './Components/SimpleCodeEditor';
export type SnippetEditorHandle = {
  save: () => void;
  setCode: (val: string) => void;
};

type SnippetEditorProps = {
  snippetIndex?: number;
  language: 'css' | 'js';
};

const SnippetEditor = React.forwardRef<SnippetEditorHandle, SnippetEditorProps>(
  ({ snippetIndex, language }, ref) => {
    const navigation = useNavigation();
    const theme = useTheme();
    const {
      codeSnippetsJS,
      codeSnippetsCSS,
      setChapterReaderSettings: setSettings,
    } = useChapterReaderSettings();

    const isEditing = snippetIndex !== undefined && snippetIndex >= 0;
    const snippets = language === 'js' ? codeSnippetsJS : codeSnippetsCSS;
    const snippet = isEditing ? snippets[snippetIndex!] : null;

    const [code, setCode] = React.useState<string>(snippet?.code ?? '');
    const [error, setError] = React.useState({ code: false });
    const [highlightMode, setHighlightMode] =
      React.useState<HighlightMode>('combined');
    const [snippetName, setSnippetName] = React.useState('');

    const [showNameModal, setShowNameModal] = React.useState(false);

    const save = React.useCallback(() => {
      setError({ code: false });
      if (!code.trim()) {
        setError({ code: true });
        return;
      }
      if (isEditing) {
        const newSnippets = [...snippets];
        newSnippets[snippetIndex!].code = code;
        setSettings({
          [language === 'js' ? 'codeSnippetsJS' : 'codeSnippetsCSS']:
            newSnippets,
        });
        showToast(getString('customCodeSettings.snippetUpdated'));
        navigation.goBack();
      } else {
        setShowNameModal(true);
      }
    }, [
      code,
      snippets,
      setSettings,
      isEditing,
      snippetIndex,
      language,
      navigation,
    ]);
    const handleNameModalSave = React.useCallback(() => {
      if (!snippetName.trim()) return false;
      const newSnippets = [...snippets];
      newSnippets.push({
        name: snippetName.trim(),
        code,
        active: true,
        lang: language,
      });
      setSettings({
        [language === 'js' ? 'codeSnippetsJS' : 'codeSnippetsCSS']: newSnippets,
      });
      showToast(getString('customCodeSettings.snippetSaved'));
      setShowNameModal(false);
      navigation.goBack();
      return true;
    }, [snippetName, code, language, snippets, setSettings, navigation]);

    const handleNameModalCancel = React.useCallback(() => {
      setShowNameModal(false);
      setSnippetName('');
    }, []);

    React.useImperativeHandle(ref, () => ({ save, setCode }), [save, setCode]);

    return (
      <>
        <View style={styles.toolbar}>
          <IconButtonV2
            name="code-braces"
            color={
              highlightMode === 'off'
                ? theme.outline
                : highlightMode === 'on'
                ? theme.primary
                : theme.secondary
            }
            size={24}
            theme={theme}
            onPress={() =>
              setHighlightMode(prev =>
                prev === 'off'
                  ? 'combined'
                  : prev === 'combined'
                  ? 'on'
                  : 'off',
              )
            }
            style={{ position: 'absolute', end: 8, top: 8, zIndex: 2 }}
          />
        </View>
        <KeyboardAwareScrollView
          style={styles.scrollContainer}
          bottomOffset={100}
          nestedScrollEnabled
          contentContainerStyle={styles.flexGrow}
        >
          <CodeInput
            language={language}
            code={code}
            setCode={setCode}
            highlightMode={highlightMode}
            error={error.code}
          />
        </KeyboardAwareScrollView>
        <KeyboardAvoidingModal
          visible={showNameModal}
          onDismiss={handleNameModalCancel}
          onSave={handleNameModalSave}
          onCancel={handleNameModalCancel}
          title={getString('common.name')}
        >
          <PaperTextInput
            label={getString('common.name')}
            defaultValue={snippetName}
            onChangeText={setSnippetName}
            autoFocus
            mode="outlined"
            style={styles.mb16}
            theme={{ colors: theme }}
          />
        </KeyboardAvoidingModal>
      </>
    );
  },
);

export default React.memo(SnippetEditor);

const styles = StyleSheet.create({
  flexGrow: { flexGrow: 1 },
  mb16: { marginBottom: 16 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scrollContainer: {
    paddingHorizontal: 2,
  },
  scrollContent: {},
  button: {
    marginHorizontal: 8,
    flexBasis: '40%',
    flex: 1,
  },
});
