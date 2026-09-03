import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { Dialog, List, TextInput } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import type { TranslationPrompt } from '@api/translation/types';

interface PromptsManagerProps {
  prompts: TranslationPrompt[];
  onChange: (prompts: TranslationPrompt[]) => void;
}

const emptyPrompt = (): TranslationPrompt => ({
  id: `prompt-${Date.now()}`,
  name: '',
  content: '',
});

const PromptsManager: React.FC<PromptsManagerProps> = ({
  prompts,
  onChange,
}) => {
  const theme = useTheme();
  const [editing, setEditing] = useState<TranslationPrompt | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [contentDraft, setContentDraft] = useState('');

  const openEditor = (prompt?: TranslationPrompt) => {
    const next = prompt ?? emptyPrompt();
    setEditing(next);
    setNameDraft(next.name);
    setContentDraft(next.content);
  };

  const close = () => setEditing(null);

  const save = () => {
    if (!editing) return;
    const name = nameDraft.trim();
    if (name.length === 0) {
      close();
      return;
    }
    const next = { ...editing, name, content: contentDraft };
    const exists = prompts.some(p => p.id === next.id);
    onChange(
      exists
        ? prompts.map(p => (p.id === next.id ? next : p))
        : [...prompts, next],
    );
    close();
  };

  const remove = (id: string) => {
    onChange(prompts.filter(p => p.id !== id));
  };

  return (
    <>
      {prompts.length === 0 ? (
        <List.InfoItem
          title={getString('translationSettings.noPrompts')}
          theme={theme}
        />
      ) : (
        prompts.map(prompt => (
          <Pressable
            key={prompt.id}
            style={styles.row}
            android_ripple={{ color: theme.rippleColor }}
            onPress={() => openEditor(prompt)}
          >
            <View style={styles.rowText}>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: theme.onSurface }]}
              >
                {prompt.name}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.content, { color: theme.onSurfaceVariant }]}
              >
                {prompt.content}
              </Text>
            </View>
            <Icon
              name="pencil-outline"
              size={20}
              color={theme.onBackground}
              onPress={event => {
                event.stopPropagation();
                openEditor(prompt);
              }}
            />
            <Icon
              name="trash-can-outline"
              size={20}
              color={theme.onBackground}
              style={styles.deleteIcon}
              onPress={event => {
                event.stopPropagation();
                remove(prompt.id);
              }}
            />
          </Pressable>
        ))
      )}
      <List.Item
        title={getString('translationSettings.addPrompt')}
        icon="plus"
        onPress={() => openEditor()}
        theme={theme}
      />

      <Dialog.Root visible={editing !== null} onDismiss={close}>
        <Dialog.Header>
          <Dialog.Title>
            {editing && prompts.some(p => p.id === editing.id)
              ? getString('translationSettings.editPrompt')
              : getString('translationSettings.addPrompt')}
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>
          <TextInput
            placeholder={getString('translationSettings.promptName')}
            defaultValue={nameDraft}
            onChangeText={setNameDraft}
            style={styles.field}
          />
          <TextInput
            placeholder={getString('translationSettings.promptContent')}
            defaultValue={contentDraft}
            onChangeText={setContentDraft}
            multiline
            style={[styles.field, styles.contentField]}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Dialog.Action onPress={close}>
            {getString('common.cancel')}
          </Dialog.Action>
          <Dialog.Action onPress={save}>
            {getString('common.save')}
          </Dialog.Action>
        </Dialog.Actions>
      </Dialog.Root>
    </>
  );
};

export default React.memo(PromptsManager);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 4,
    flexDirection: 'row',
    marginHorizontal: 12,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontSize: 14,
  },
  content: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteIcon: {
    marginStart: 12,
  },
  field: {
    marginTop: 12,
  },
  contentField: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
