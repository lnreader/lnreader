import { Button, TextInput } from '@components';
import { Row } from '@components/Common';
import { ToggleButton } from '@components/Common/ToggleButton';
import { getString } from '@strings/translations';
import React from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import CodeInput from './Components/CodeInput';
import { showToast } from '@utils/showToast';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';

type SnippetEditorProps = {
  snippetIndex?: number;
  isJS?: boolean;
  navigation: { goBack: () => void };
};

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const SnippetEditor: React.FC<SnippetEditorProps> = ({
  snippetIndex,
  isJS,
  navigation,
}) => {
  const theme = useTheme();
  const {
    codeSnippetsJS,
    codeSnippetsCSS,
    setChapterReaderSettings: setSettings,
  } = useChapterReaderSettings();

  const isEditing = snippetIndex !== undefined && snippetIndex >= 0;

  const [language, setLanguage] = React.useState<'js' | 'css'>(
    isJS === false ? 'css' : 'js',
  );

  const snippets = language === 'js' ? codeSnippetsJS : codeSnippetsCSS;
  const snippet = isEditing ? snippets[snippetIndex!] : null;

  const [title, setTitle] = React.useState<string>('');
  const [code, setCode] = React.useState<string>('');
  const [error, setError] = React.useState({ title: false, code: false });

  const scrollViewRef = React.useRef<ScrollView>(null);
  const codeSectionY = React.useRef(0);

  // Update fields when snippet changes
  React.useEffect(() => {
    setTitle(snippet?.name ?? '');
    setCode(snippet?.code ?? '');
    setError({ title: false, code: false });
  }, [snippet]);

  // Update language when editing an existing snippet
  React.useEffect(() => {
    if (isEditing && snippet) {
      setLanguage(snippet.lang);
    }
  }, [isEditing, snippet]);

  const { height: windowHeight } = useWindowDimensions();
  const { height: keyboardHeight } = useAnimatedKeyboard();

  const maxHeightScrollView = useAnimatedStyle(() => ({
    maxHeight: windowHeight - keyboardHeight.value,
  }));

  const colors = React.useMemo(
    () => ({ colors: theme }),
    [theme],
  );

  const handleCodeFocus = () => {
    // Scroll the code block into view when the user starts editing
    scrollViewRef.current?.scrollTo({
      y: codeSectionY.current,
      animated: true,
    });
  };

  const onCodeSectionLayout = (e: LayoutChangeEvent) => {
    codeSectionY.current = e.nativeEvent.layout.y;
  };

  const save = React.useCallback(() => {
    setError({ title: false, code: false });
    if (!code.trim() || !title.trim()) {
      setError({ title: !title.trim(), code: !code.trim() });
      return;
    }
    const newSnippets = [...snippets];

    if (isEditing) {
      newSnippets[snippetIndex!].name = title;
      newSnippets[snippetIndex!].code = code;
      newSnippets[snippetIndex!].lang = language;
      setSettings({
        [language === 'js' ? 'codeSnippetsJS' : 'codeSnippetsCSS']: newSnippets,
      });
      showToast('Snippet updated successfully');
    } else {
      newSnippets.push({
        name: title,
        code,
        active: true,
        lang: language,
      });
      setSettings({
        [language === 'js' ? 'codeSnippetsJS' : 'codeSnippetsCSS']: newSnippets,
      });
      showToast('Snippet saved successfully');
    }
    navigation.goBack();
  }, [
    language,
    snippets,
    title,
    code,
    setSettings,
    isEditing,
    snippetIndex,
    navigation,
  ]);

  return (
    <AnimatedScrollView
      ref={scrollViewRef}
      style={[styles.scrollContainer, maxHeightScrollView]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={styles.scrollContent}
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
      <Animated.View onLayout={onCodeSectionLayout}>
        <CodeInput
          language={language}
          code={code}
          setCode={setCode}
          error={error.code}
          onFocus={handleCodeFocus}
        />
      </Animated.View>
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

export default React.memo(SnippetEditor);

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 16,
  },
  scrollContent: {},
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
});
