import { AppText, Button, Dialog, TextInput } from '@components';
import { useBoolean } from '@hooks/index';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import React, { useCallback, useMemo } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import AddIcon from '@expo/material-symbols/add.xml';
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

  const [text, setText] = React.useState('');
  const [replacementText, setReplacementText] = React.useState('');
  const [editing, setEditing] = React.useState<string>();
  const [error, setError] = React.useState<[string, string]>();

  const resetForm = useCallback(() => {
    setError(undefined);
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

  return (
    <>
      <Column modifiers={[fillMaxWidth()]}>
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
          icon={AddIcon}
          mode="outlined"
          onPress={modal.setTrue}
          modifiers={[fillMaxWidth(), padding(16, 4, 16, 4)]}
          title={
            showReplace
              ? getString('customCodeSettings.addReplaceRule')
              : getString('customCodeSettings.addRemoveRule')
          }
        />
      </Column>
      <Dialog.Root visible={modal.value} onDismiss={closeModal}>
        <Dialog.Header>
          <Dialog.Title>
            {getString('customCodeSettings.editReplace')}
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>
          <Column verticalArrangement={{ spacedBy: 12 }}>
            <TextInput
              label={getString(
                showReplace
                  ? 'common.textToReplace'
                  : 'customCodeSettings.removeText',
              )}
              value={text}
              onChangeText={setText}
              singleLine
              error={error?.[0] || null}
            />
            {showReplace ? (
              <TextInput
                label={getString('common.replaceWith')}
                value={replacementText}
                onChangeText={setReplacementText}
                singleLine
                error={error?.[1] || null}
              />
            ) : null}
            <AppText variant="bodySmall" color={theme.onSurfaceVariant}>
              {getString('customCodeSettings.regexHint')}
            </AppText>
          </Column>
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
