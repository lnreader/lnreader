import { Button, TextInput } from '@components';
import { Row } from '@components/Common';
import { ToggleButton } from '@components/Common/ToggleButton';
import { WINDOW_HEIGHT } from '@gorhom/bottom-sheet';
import { getString } from '@strings/translations';
import React from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import CodeInput from '../Components/CodeInput';
import { showToast } from '@utils/showToast';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';

type CodeRouteProps = {
  language?: 'css' | 'js';
  snippetIndex?: number;
  jumpTo: (key: string) => void;
  editingSnippet?: {
    index: number;
    isJS: boolean;
  } | null;
  onSnippetSaved?: () => void;
};

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const CodeRoute = ({
  language: dLang,
  snippetIndex,
  jumpTo,
  editingSnippet,
  onSnippetSaved,
}: CodeRouteProps) => {
  const theme = useTheme();
  const {
    codeSnippetsJS,
    codeSnippetsCSS,
    setChapterReaderSettings: setSettings,
  } = useChapterReaderSettings();
  const [error, setError] = React.useState({ title: false, code: false });

  // Use editingSnippet if provided, otherwise fall back to old props
  const isEditing = editingSnippet !== null && editingSnippet !== undefined;
  const editIndex = isEditing ? editingSnippet.index : snippetIndex;
  const editIsJS = isEditing ? editingSnippet.isJS : dLang === 'js';

  const [language, setLanguage] = React.useState<'js' | 'css'>('js');

  // Update language when editing state changes
  React.useEffect(() => {
    if (isEditing) {
      setLanguage(editIsJS ? 'js' : 'css');
    } else {
      setLanguage('js'); // Default to JS for new snippets
    }
  }, [isEditing, editIsJS]);

  const snippets = language === 'js' ? codeSnippetsJS : codeSnippetsCSS;
  const snippet =
    editIndex === undefined || editIndex === -1 ? null : snippets[editIndex];

  const [title, setTitle] = React.useState<string>('');
  const [code, setCode] = React.useState<string>('');

  // Update title, code, and reset errors when snippet changes
  React.useEffect(() => {
    setTitle(snippet?.name ?? '');
    setCode(snippet?.code ?? '');
    setError({ title: false, code: false });
  }, [snippet]);

  const { height: keyboardHeight } = useAnimatedKeyboard();

  const ScrollViewRef = React.useRef<ScrollView>(null);

  const maxHeightScrollView = useAnimatedStyle(() => {
    return {
      maxHeight: WINDOW_HEIGHT - keyboardHeight.value - 26,
    };
  });

  const colors = React.useMemo(
    () => ({
      colors: theme,
    }),
    [theme],
  );

  const save = React.useCallback(() => {
    setError({ title: false, code: false });
    if (!code.trim() || !title.trim()) {
      setError({ title: !title.trim(), code: !code.trim() });
      return;
    }

    // Editing existing snippet
    if (isEditing && editIndex !== undefined && editIndex !== -1) {
      snippets[editIndex].name = title;
      snippets[editIndex].code = code;
      setSettings({
        [language === 'js' ? 'codeSnippetsJS' : 'codeSnippetsCSS']: snippets,
      });
      showToast('Snippet updated successfully');
      onSnippetSaved?.();
      return;
    }

    // Creating new snippet
    snippets.push({
      name: title,
      code,
      active: true,
      lang: language,
    });
    setSettings({
      [language === 'js' ? 'codeSnippetsJS' : 'codeSnippetsCSS']: snippets,
    });
    showToast('Snippet saved successfully');
    jumpTo('first'); // Go back to settings tab
  }, [
    language,
    snippets,
    title,
    code,
    setSettings,
    jumpTo,
    isEditing,
    editIndex,
    onSnippetSaved,
  ]);

  return (
    <AnimatedScrollView
      ref={ScrollViewRef}
      style={[styles.container, maxHeightScrollView]}
    >
      <Row verticalSpacing={8}>
        <Text theme={colors} style={styles.text}>
          {'Select CSS or JS'}
        </Text>
        <ToggleButton
          theme={theme}
          icon="language-css3"
          selected={language === 'css'}
          onPress={() => setLanguage('css')}
          disabled={isEditing}
        />
        <ToggleButton
          theme={theme}
          icon="language-javascript"
          selected={language === 'js'}
          onPress={() => setLanguage('js')}
          disabled={isEditing}
        />
      </Row>
      <TextInput
        placeholder={'Snippet name'}
        defaultValue={title}
        onChangeText={setTitle}
        style={styles.snippetName}
        error={error.title}
      />
      <CodeInput
        language={language}
        code={code}
        setCode={setCode}
        error={error.code}
      />
      <Row verticalSpacing={8}>
        <Button
          style={styles.button}
          title={getString('readerSettings.openJSFile')}
          mode="outlined"
        />
        <Button
          style={styles.button}
          title={getString('common.save')}
          mode="contained"
          onPress={save}
        />
      </Row>
    </AnimatedScrollView>
  );
};

export default React.memo(CodeRoute);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  text: {
    flex: 1,
  },
  button: {
    marginHorizontal: 8,
    flexBasis: '40%',
    flex: 1,
  },
  snippetName: {
    marginTop: 8,
    marginBottom: 16,
  },
  fakeTextInput: {
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 1,
    marginVertical: 2,
  },
  topField: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    flexGrow: 1,
  },
  codeField: {
    verticalAlign: 'top',
    flexGrow: 1,
    borderRadius: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  bottomField: {
    flexGrow: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
  },
});
