import React, { useState } from 'react';
import { TextInput } from 'react-native-paper';

import { Dialog } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { TrackChaptersDialogProps } from './types';

type SetTrackChaptersDialogContentProps = Omit<
  TrackChaptersDialogProps,
  'visible'
>;

const SetTrackChaptersDialogContent: React.FC<
  SetTrackChaptersDialogContentProps
> = ({ trackItem, onDismiss, onUpdateChapters }) => {
  const theme = useTheme();
  const [chapters, setChapters] = useState(String(trackItem.progress ?? 0));

  const handleSave = () => {
    onUpdateChapters(chapters);
  };

  const handleChangeText = (text: string) => {
    setChapters(text ? text : '');
  };

  return (
    <Dialog.Root visible onDismiss={onDismiss}>
      <Dialog.Title>Chapters</Dialog.Title>
      <Dialog.Content>
        <TextInput
          value={chapters}
          onChangeText={handleChangeText}
          mode="outlined"
          keyboardType="numeric"
          theme={{
            colors: {
              primary: theme.primary,
              placeholder: theme.outline,
              text: theme.onSurface,
              background: 'transparent',
            },
          }}
          underlineColor={theme.outline}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action onPress={handleSave}>
          {getString('common.save')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

const SetTrackChaptersDialog: React.FC<TrackChaptersDialogProps> = ({
  visible,
  ...props
}) => (visible ? <SetTrackChaptersDialogContent {...props} /> : null);

export default SetTrackChaptersDialog;
