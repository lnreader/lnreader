import { Button, Dialog } from '@components';
import { useBoolean } from '@hooks/index';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { RemoveItem, ReplaceItem } from '../Components/ListItems';

type ReplaceItemModalProps = {
  showReplace?: boolean;
};

const ReplaceItemModal = ({ showReplace = false }: ReplaceItemModalProps) => {
  const theme = useTheme();
  const modal = useBoolean(false);
  const {
    setChapterReaderSettings: setSettings,
    replaceText,
    removeText,
  } = useChapterReaderSettings();
  const replaceArray = useMemo(
    () => Object.entries(replaceText),
    [replaceText],
  );

  const textRef = useRef<TextInputInstance>(null);
  const replaceTextRef = useRef<TextInputInstance>(null);

  const [text, setText] = React.useState('');
  const [replacementText, setReplacementText] = React.useState('');
  const [editing, setEditing] = React.useState<string>();
  const [error, setError] = React.useState<[string, string]>();

  const resetForm = useCallback(() => {
    setError(undefined);
    textRef.current?.clear();
    replaceTextRef.current?.clear();
    setText('');
    setReplacementText('');
    setEditing(undefined);
  }, []);

  const closeModal = useCallback(() => {
    resetForm();
    modal.setFalse();
  }, [modal, resetForm]);

  const save = () => {
    if (!text || (showReplace && !replacementText)) {
      const nextError: [string, string] = ['', ''];
      if (!text) nextError[0] = getString('customCodeSettings.enterAMatch');
      if (showReplace && !replacementText) {
        nextError[1] = getString('customCodeSettings.enterAReplace');
      }
      setError(nextError);
      return;
    }

    if (showReplace) {
      const nextReplaceText = { ...replaceText };
      if (editing && editing !== text) delete nextReplaceText[editing];
      nextReplaceText[text] = replacementText;
      setSettings({ replaceText: nextReplaceText });
    } else {
      const nextRemoveText = [...removeText];
      if (editing) {
        const index = nextRemoveText.findIndex(value => value === editing);
        nextRemoveText[index] = text;
      } else if (!nextRemoveText.includes(text)) {
        nextRemoveText.push(text);
      } else {
        setError([getString('customCodeSettings.itemAlreadyExists'), '']);
        return;
      }
      setSettings({ removeText: nextRemoveText });
    }
    closeModal();
  };

  const removeItem = useCallback(
    (identifier: string | number) => {
      if (showReplace) {
        const nextReplaceText = { ...replaceText };
        delete nextReplaceText[String(identifier)];
        setSettings({ replaceText: nextReplaceText });
      } else {
        setSettings({
          removeText: removeText.filter((_, index) => index !== identifier),
        });
      }
    },
    [removeText, replaceText, setSettings, showReplace],
  );

  const editItem = useCallback(
    (item: string[]) => {
      setEditing(item[0]);
      setText(item[0]);
      if (showReplace) setReplacementText(item[1]);
      modal.setTrue();
    },
    [modal, showReplace],
  );

  const colorTheme = useMemo(() => ({ colors: theme }), [theme]);

  return (
    <>
      <View>
        {showReplace
          ? replaceArray.map(item => (
              <ReplaceItem
                key={item[0]}
                item={item}
                removeItem={removeItem}
                editItem={editItem}
              />
            ))
          : removeText.map((item, index) => (
              <RemoveItem
                key={`${item}-${index}`}
                item={item}
                index={index}
                removeItem={removeItem}
                editItem={editItem}
              />
            ))}
        <Button
          icon="plus"
          mode="outlined"
          onPress={modal.setTrue}
          style={styles.addButton}
        >
          {showReplace
            ? getString('customCodeSettings.addReplaceRule')
            : getString('customCodeSettings.addRemoveRule')}
        </Button>
      </View>
      <Dialog.Root visible={modal.value} onDismiss={closeModal}>
        <Dialog.Header>
          <Dialog.Title>
            {getString('customCodeSettings.editReplace')}
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>
          <TextInput
            ref={textRef}
            label={getString(
              showReplace
                ? 'common.textToReplace'
                : 'customCodeSettings.removeText',
            )}
            theme={colorTheme}
            value={text}
            onChangeText={setText}
            autoCorrect={false}
            mode="outlined"
            style={showReplace ? styles.pairedTextfield : styles.hintTextfield}
            error={Boolean(error?.[0])}
          />
          {showReplace ? (
            <TextInput
              ref={replaceTextRef}
              label={getString('common.replaceWith')}
              theme={colorTheme}
              value={replacementText}
              onChangeText={setReplacementText}
              autoCorrect={false}
              mode="outlined"
              style={styles.hintTextfield}
              error={Boolean(error?.[1])}
            />
          ) : null}
          <Text style={[styles.regexHint, { color: theme.onSurfaceVariant }]}>
            {getString('customCodeSettings.regexHint')}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Dialog.Action onPress={closeModal}>
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

export default ReplaceItemModal;

const styles = StyleSheet.create({
  addButton: {
    marginBottom: 16,
    marginHorizontal: 16,
    marginTop: 8,
  },
  pairedTextfield: {
    marginBottom: 2,
  },
  hintTextfield: {
    marginBottom: 4,
  },
  regexHint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
});
