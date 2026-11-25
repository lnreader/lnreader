import { Appbar, Button, Dialog, SafeAreaView } from '@components';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { CustomCodeSettingsScreenProps } from '@navigators/types';
import Icon from '@react-native-vector-icons/material-design-icons';
import React from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import Snippet from './Components/Snippet';
import ReplaceItemModal from './Modals/ReplaceItemModal';

type SectionHeaderProps = {
  status?: string;
  theme: ThemeColors;
  title: string;
};

const SectionHeader = ({ status, theme, title }: SectionHeaderProps) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
      {title}
    </Text>
    {status ? (
      <Text style={[styles.sectionStatus, { color: theme.onSurfaceVariant }]}>
        {status}
      </Text>
    ) : null}
  </View>
);

const SettingsCustomCode = ({ navigation }: CustomCodeSettingsScreenProps) => {
  const theme = useTheme();
  const {
    codeSnippetsJS,
    codeSnippetsCSS,
    removeText,
    replaceText,
    setChapterReaderSettings: setSettings,
  } = useChapterReaderSettings();
  const [renameSnippet, setRenameSnippet] = React.useState<{
    index: number;
    isJS: boolean;
    name: string;
  } | null>(null);

  const totalRules = removeText.length + Object.keys(replaceText).length;
  const totalSnippets = codeSnippetsCSS.length + codeSnippetsJS.length;
  const activeSnippets = [...codeSnippetsCSS, ...codeSnippetsJS].filter(
    snippet => snippet.active,
  ).length;

  const toggleSnippet = React.useCallback(
    (index: number, isJS: boolean) => {
      const snippets = isJS ? codeSnippetsJS : codeSnippetsCSS;
      const nextSnippets = snippets.map((snippet, snippetIndex) =>
        snippetIndex === index
          ? { ...snippet, active: !snippet.active }
          : snippet,
      );
      setSettings({
        [isJS ? 'codeSnippetsJS' : 'codeSnippetsCSS']: nextSnippets,
      });
    },
    [codeSnippetsJS, codeSnippetsCSS, setSettings],
  );

  const deleteSnippet = React.useCallback(
    (index: number, isJS: boolean) => {
      const snippets = isJS ? codeSnippetsJS : codeSnippetsCSS;
      setSettings({
        [isJS ? 'codeSnippetsJS' : 'codeSnippetsCSS']: snippets.filter(
          (_, snippetIndex) => snippetIndex !== index,
        ),
      });
    },
    [codeSnippetsJS, codeSnippetsCSS, setSettings],
  );

  const handleEditSnippet = React.useCallback(
    (snippetIndex: number, isJS: boolean) => {
      navigation.navigate('CodeSnippets', { snippetIndex, isJS });
    },
    [navigation],
  );

  const handleRenameSnippet = React.useCallback(
    (index: number, isJS: boolean, name: string) => {
      setRenameSnippet({ index, isJS, name });
    },
    [],
  );

  const handleRenameSave = React.useCallback(() => {
    if (!renameSnippet || !renameSnippet.name.trim()) return;
    const snippets = renameSnippet.isJS ? codeSnippetsJS : codeSnippetsCSS;
    const nextSnippets = snippets.map((snippet, index) =>
      index === renameSnippet.index
        ? { ...snippet, name: renameSnippet.name.trim() }
        : snippet,
    );
    setSettings({
      [renameSnippet.isJS ? 'codeSnippetsJS' : 'codeSnippetsCSS']: nextSnippets,
    });
    setRenameSnippet(null);
  }, [renameSnippet, codeSnippetsJS, codeSnippetsCSS, setSettings]);

  const handleRenameCancel = React.useCallback(() => {
    setRenameSnippet(null);
  }, []);

  return (
    <SafeAreaView excludeTop>
      <Appbar
        mode="small"
        title={getString('common.custom_code')}
        handleGoBack={() => {
          Keyboard.dismiss();
          navigation.goBack();
        }}
        theme={theme}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.description, { color: theme.onSurfaceVariant }]}>
          {getString('customCodeSettings.description')}
        </Text>

        <View style={styles.section}>
          <SectionHeader
            status={getString('customCodeSettings.ruleCount', {
              count: totalRules,
            })}
            theme={theme}
            title={getString('customCodeSettings.textRules')}
          />
          <ReplaceItemModal showReplace />
          <ReplaceItemModal />
        </View>

        <View
          style={[styles.divider, { backgroundColor: theme.outlineVariant }]}
        />

        <View style={styles.section}>
          <SectionHeader
            status={
              totalSnippets > 0
                ? getString('customCodeSettings.activeSnippetCount', {
                    count: activeSnippets,
                    total: totalSnippets,
                  })
                : undefined
            }
            theme={theme}
            title={getString('customCodeSettings.codeSnippets')}
          />

          {codeSnippetsCSS.map((snippet, index) => (
            <Snippet
              key={`css-${index}`}
              toggle={toggleSnippet}
              rename={handleRenameSnippet}
              edit={handleEditSnippet}
              delete={deleteSnippet}
              index={index}
              snippet={snippet}
            />
          ))}
          {codeSnippetsJS.map((snippet, index) => (
            <Snippet
              key={`js-${index}`}
              toggle={toggleSnippet}
              rename={handleRenameSnippet}
              edit={handleEditSnippet}
              delete={deleteSnippet}
              index={index}
              snippet={snippet}
            />
          ))}

          {totalSnippets === 0 ? (
            <View style={styles.emptyState}>
              <Icon
                accessible={false}
                name="code-tags"
                size={24}
                color={theme.onSurfaceVariant}
              />
              <Text
                style={[styles.emptyText, { color: theme.onSurfaceVariant }]}
              >
                {getString('customCodeSettings.noCodeSnippets')}
              </Text>
            </View>
          ) : null}

          <View style={styles.snippetActions}>
            <Button
              icon="plus"
              mode="outlined"
              onPress={() => handleEditSnippet(-1, false)}
              style={styles.snippetButton}
            >
              CSS
            </Button>
            <Button
              icon="plus"
              mode="outlined"
              onPress={() => handleEditSnippet(-1, true)}
              style={styles.snippetButton}
            >
              JavaScript
            </Button>
          </View>
        </View>
      </ScrollView>
      <Dialog.Root
        visible={renameSnippet !== null}
        onDismiss={handleRenameCancel}
      >
        <Dialog.Header>
          <Dialog.Title>
            {getString('customCodeSettings.renameSnippet')}
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>
          <TextInput
            label={getString('common.name')}
            value={renameSnippet?.name ?? ''}
            onChangeText={name => {
              if (renameSnippet) setRenameSnippet({ ...renameSnippet, name });
            }}
            autoFocus
            mode="outlined"
            style={styles.textfield}
            theme={{ colors: theme }}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Dialog.Action onPress={handleRenameCancel}>
            {getString('common.cancel')}
          </Dialog.Action>
          <Dialog.Action onPress={handleRenameSave}>
            {getString('common.save')}
          </Dialog.Action>
        </Dialog.Actions>
      </Dialog.Root>
    </SafeAreaView>
  );
};

export default SettingsCustomCode;

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    marginHorizontal: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    width: '100%',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 24,
  },
  sectionStatus: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 16,
    textAlign: 'right',
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  snippetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  snippetButton: {
    flexBasis: 140,
    flexGrow: 1,
  },
  textfield: {
    marginBottom: 16,
  },
});
