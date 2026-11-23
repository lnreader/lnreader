import { getString } from '@i18n/translations';
import React from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import CodeInput from './Components/CodeInput';
import { showToast } from '@utils/showToast';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { TextInput as PaperTextInput } from 'react-native-paper';

import { useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Dialog, IconButtonV2 } from '@components';
import type { HighlightMode } from './Components/SimpleCodeEditor';
import { useMMKVString } from 'react-native-mmkv';
import { formatSnippet } from './formatSnippet';
export type SnippetEditorHandle = {
  save: () => void;
  setCode: (val: string) => void;
  getCode: () => string;
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
    const [highlightMode = 'combined', setHighlightMode] = useMMKVString(
      `snippetEditorHighlightMode`,
    ) as [
      HighlightMode,
      (value: HighlightMode | ((prev: HighlightMode) => HighlightMode)) => void,
    ];

    const [snippetName, setSnippetName] = React.useState('');

    const [showNameModal, setShowNameModal] = React.useState(false);

    const editorScrollSink = React.useRef<((y: number) => void) | null>(null);
    const handleScroll = React.useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        editorScrollSink.current?.(e.nativeEvent.contentOffset.y);
      },
      [],
    );

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

    const handleBeautify = React.useCallback(() => {
      if (!code.trim()) return;
      try {
        setCode(formatSnippet(code, language));
      } catch {
        showToast(getString('customCodeSettings.beautifyFailed'));
      }
    }, [code, language]);

    React.useImperativeHandle(
      ref,
      () => ({ save, setCode, getCode: () => code }),
      [save, setCode, code],
    );

    return (
      <>
        <View style={styles.editorContainer}>
          <View style={styles.toolbar}>
            <IconButtonV2
              accessibilityLabel={getString('customCodeSettings.beautifyCode')}
              name="auto-fix"
              disabled={!code.trim()}
              padding={10}
              theme={theme}
              onPress={handleBeautify}
            />
            <IconButtonV2
              accessibilityLabel={getString(
                'customCodeSettings.syntaxHighlighting',
              )}
              name="code-braces"
              color={
                highlightMode === 'off'
                  ? theme.outline
                  : highlightMode === 'on'
                  ? theme.primary
                  : theme.secondary
              }
              size={24}
              padding={10}
              theme={theme}
              onPress={() =>
                setHighlightMode((prev: HighlightMode) =>
                  prev === 'off'
                    ? 'combined'
                    : prev === 'combined'
                    ? 'on'
                    : 'off',
                )
              }
            />
          </View>
          <KeyboardAwareScrollView
            style={styles.scrollContainer}
            bottomOffset={100}
            nestedScrollEnabled
            scrollEventThrottle={16}
            onScroll={handleScroll}
            contentContainerStyle={styles.flexGrow}
          >
            <CodeInput
              language={language}
              code={code}
              setCode={setCode}
              highlightMode={highlightMode}
              error={error.code}
              scrollSink={editorScrollSink}
            />
          </KeyboardAwareScrollView>
        </View>
        <Dialog.Root visible={showNameModal} onDismiss={handleNameModalCancel}>
          <Dialog.Header>
            <Dialog.Title>{getString('common.name')}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Content>
            <PaperTextInput
              label={getString('common.name')}
              defaultValue={snippetName}
              onChangeText={setSnippetName}
              autoFocus
              mode="outlined"
              style={styles.mb16}
              theme={{ colors: theme }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Dialog.Action onPress={handleNameModalCancel}>
              Cancel
            </Dialog.Action>
            <Dialog.Action
              onPress={() => {
                if (handleNameModalSave()) setShowNameModal(false);
              }}
            >
              Save
            </Dialog.Action>
          </Dialog.Actions>
        </Dialog.Root>
      </>
    );
  },
);

export default React.memo(SnippetEditor);

const styles = StyleSheet.create({
  flexGrow: { flexGrow: 1 },
  mb16: { marginBottom: 16 },
  editorContainer: {
    flex: 1,
    paddingTop: 12,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    end: 8,
    top: 12,
    zIndex: 2,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 2,
  },
  scrollContent: {},
  button: {
    marginHorizontal: 8,
    flexBasis: '40%',
    flex: 1,
  },
});
