import { Appbar, List, SafeAreaView } from '@components';
import { CustomCodeSettingsScreenProps } from '@navigators/types';
import React from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import KeyboardAvoidingModal from '@components/Modal/KeyboardAvoidingModal';
import ReplaceItemModal from './Modals/ReplaceItemModal';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';
import Snippet from './Components/Snippet';

const SettingsCustomCode = ({ navigation }: CustomCodeSettingsScreenProps) => {
  const theme = useTheme();
  const {
    codeSnippetsJS,
    codeSnippetsCSS,
    setChapterReaderSettings: setSettings,
  } = useChapterReaderSettings();
  const [renameSnippet, setRenameSnippet] = React.useState<{
    index: number;
    isJS: boolean;
    name: string;
  } | null>(null);
  const [extended, setExtended] = React.useState([false, false, false, false]);

  const toggleExtended = React.useCallback(
    (index: number) => {
      const newExtended = [false, false, false, false];
      newExtended[index] = !extended[index];
      setExtended(newExtended);
    },
    [extended],
  );

  const toggleSnippet = React.useCallback(
    (index: number, isJS: boolean) => {
      const snippets = isJS ? [...codeSnippetsJS] : [...codeSnippetsCSS];
      snippets[index].active = !snippets[index].active;
      setSettings({
        [isJS ? 'codeSnippetsJS' : 'codeSnippetsCSS']: snippets,
      });
    },
    [codeSnippetsJS, codeSnippetsCSS, setSettings],
  );

  const deleteSnippet = React.useCallback(
    (index: number, isJS: boolean) => {
      const snippets = isJS ? [...codeSnippetsJS] : [...codeSnippetsCSS];
      snippets.splice(index, 1);
      setSettings({
        [isJS ? 'codeSnippetsJS' : 'codeSnippetsCSS']: snippets,
      });
    },
    [codeSnippetsJS, codeSnippetsCSS, setSettings],
  );

  const handleEditSnippet = (snippetIndex: number, isJS: boolean) => {
    navigation.navigate('CodeSnippets', {
      snippetIndex,
      isJS,
    });
  };

  const handleRenameSave = React.useCallback(() => {
    if (!renameSnippet || !renameSnippet.name.trim()) return false;
    const snippets = renameSnippet.isJS
      ? [...codeSnippetsJS]
      : [...codeSnippetsCSS];
    snippets[renameSnippet.index].name = renameSnippet.name.trim();
    setSettings({
      [renameSnippet.isJS ? 'codeSnippetsJS' : 'codeSnippetsCSS']: snippets,
    });
    setRenameSnippet(null);
    return true;
  }, [renameSnippet, codeSnippetsJS, codeSnippetsCSS, setSettings]);

  const handleRenameCancel = React.useCallback(() => {
    setRenameSnippet(null);
  }, []);

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('common.custom_code')}
        handleGoBack={() => {
          Keyboard.dismiss();
          navigation.goBack();
        }}
        theme={theme}
      />
      <ScrollView style={styles.paddingBottom}>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('customCodeSettings.textManipulation')}
          </List.SubHeader>
          <ReplaceItemModal
            showReplace
            toggleList={() => toggleExtended(0)}
            listExpanded={extended[0]}
          />
          <ReplaceItemModal
            toggleList={() => toggleExtended(1)}
            listExpanded={extended[1]}
          />
          <List.Divider theme={theme} />
          <List.SubHeader theme={theme}>
            {getString('customCodeSettings.codeSnippets')}
          </List.SubHeader>
          {/* CSS Snippets */}
          <View style={styles.subSubHeader}>
            <List.SubHeader theme={theme}>
              {getString('customCodeSettings.cssSnippets')}
            </List.SubHeader>
          </View>
          {codeSnippetsCSS.length > 0 &&
            codeSnippetsCSS.map((snippet, index) => (
              <Snippet
                key={`css-${index}`}
                toggle={toggleSnippet}
                rename={(_index, isJS, name) =>
                  setRenameSnippet({
                    index,
                    isJS,
                    name,
                  })
                }
                edit={handleEditSnippet}
                delete={deleteSnippet}
                index={index}
                snippet={snippet}
              />
            ))}
          <List.Item
            title={getString('customCodeSettings.createCSSSnippet')}
            description={getString('customCodeSettings.addCssCode')}
            theme={theme}
            right="plus"
            onPress={() => handleEditSnippet(-1, false)}
          />
          {codeSnippetsCSS.length === 0 && (
            <List.Item
              title={getString('customCodeSettings.noCodeSnippets')}
              theme={theme}
            />
          )}

          {/* JS Snippets */}
          <View style={styles.subSubHeader}>
            <List.SubHeader theme={theme}>
              {getString('customCodeSettings.javascriptSnippets')}
            </List.SubHeader>
          </View>
          {codeSnippetsJS.length > 0 &&
            codeSnippetsJS.map((snippet, index) => (
              <Snippet
                key={`js-${index}`}
                toggle={toggleSnippet}
                rename={(_index, isJS, name) =>
                  setRenameSnippet({
                    index,
                    isJS,
                    name,
                  })
                }
                edit={handleEditSnippet}
                delete={deleteSnippet}
                index={index}
                snippet={snippet}
              />
            ))}
          <List.Item
            title={getString('customCodeSettings.createJSSnippet')}
            description={getString('customCodeSettings.addJavascriptCode')}
            theme={theme}
            right="plus"
            onPress={() => handleEditSnippet(-1, true)}
          />
          {codeSnippetsJS.length === 0 && (
            <List.Item
              title={getString('customCodeSettings.noCodeSnippets')}
              theme={theme}
            />
          )}
        </List.Section>
      </ScrollView>
      <KeyboardAvoidingModal
        visible={renameSnippet !== null}
        onDismiss={handleRenameCancel}
        onSave={handleRenameSave}
        onCancel={handleRenameCancel}
        title={getString('customCodeSettings.renameSnippet')}
      >
        <TextInput
          label={getString('common.name')}
          defaultValue={renameSnippet?.name ?? ''}
          onChangeText={text => {
            if (renameSnippet) {
              setRenameSnippet({ ...renameSnippet, name: text });
            }
          }}
          autoFocus
          mode="outlined"
          style={styles.mb16}
          theme={{ colors: theme }}
        />
      </KeyboardAvoidingModal>
    </SafeAreaView>
  );
};

export default SettingsCustomCode;

const styles = StyleSheet.create({
  mb16: { marginBottom: 16 },
  paddingBottom: { paddingBottom: 40 },
  subSubHeader: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  snippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  switchItem: {
    flex: 1,
    paddingHorizontal: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
});
