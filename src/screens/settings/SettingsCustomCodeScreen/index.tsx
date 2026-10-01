import { AppIcon, AppText, Button, Dialog, List, TextInput } from '@components';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { CustomCodeSettingsScreenProps } from '@navigators/types';
import React from 'react';
import { Keyboard } from 'react-native';
import { Column, FlowRow, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import AddIcon from '@expo/material-symbols/add.xml';
import CodeIcon from '@expo/material-symbols/code.xml';
import SettingsPage from '../components/SettingsPage';
import { ThemeColors } from '@theme/types';
import Snippet from './Components/Snippet';
import ReplaceItemModal from './Modals/ReplaceItemModal';

type SectionHeaderProps = {
  status?: string;
  theme: ThemeColors;
  title: string;
};

const SectionHeader = ({ status, theme, title }: SectionHeaderProps) => (
  <Row
    verticalAlignment="center"
    modifiers={[fillMaxWidth(), padding(24, 0, 24, 8)]}
  >
    <AppText variant="titleMedium" modifiers={[weight(1)]}>
      {title}
    </AppText>
    {status ? (
      <AppText variant="bodyMedium" color={theme.onSurfaceVariant}>
        {status}
      </AppText>
    ) : null}
  </Row>
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
    <SettingsPage
      title={getString('common.custom_code')}
      onBack={() => {
        Keyboard.dismiss();
        navigation.goBack();
      }}
      overlays={
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
              singleLine
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
      }
    >
      <AppText
        variant="bodyMedium"
        color={theme.onSurfaceVariant}
        modifiers={[padding(24, 16, 24, 24)]}
      >
        {getString('customCodeSettings.description')}
      </AppText>

      <Column modifiers={[fillMaxWidth()]}>
        <SectionHeader
          status={getString('customCodeSettings.ruleCount', {
            count: totalRules,
          })}
          theme={theme}
          title={getString('customCodeSettings.textRules')}
        />
        <ReplaceItemModal showReplace />
        <ReplaceItemModal />
      </Column>

      <List.Divider theme={theme} />

      <Column modifiers={[fillMaxWidth()]}>
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
          <Column
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth(), padding(32, 24, 32, 24)]}
          >
            <AppIcon source={CodeIcon} tint={theme.onSurfaceVariant} />
            <AppText
              variant="bodyMedium"
              color={theme.onSurfaceVariant}
              align="center"
            >
              {getString('customCodeSettings.noCodeSnippets')}
            </AppText>
          </Column>
        ) : null}

        <FlowRow
          horizontalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth(), padding(16, 8, 16, 0)]}
        >
          <Button
            icon={AddIcon}
            mode="outlined"
            onPress={() => handleEditSnippet(-1, false)}
            title="CSS"
          />
          <Button
            icon={AddIcon}
            mode="outlined"
            onPress={() => handleEditSnippet(-1, true)}
            title="JavaScript"
          />
        </FlowRow>
      </Column>
    </SettingsPage>
  );
};

export default SettingsCustomCode;
