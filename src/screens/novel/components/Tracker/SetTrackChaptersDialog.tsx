import React, { useState } from 'react';

import { Dialog, TextInput } from '@components';
import { getString } from '@i18n/translations';
import { TrackChaptersDialogProps } from './types';

type SetTrackChaptersDialogContentProps = Omit<
  TrackChaptersDialogProps,
  'visible'
>;

const SetTrackChaptersDialogContent: React.FC<
  SetTrackChaptersDialogContentProps
> = ({ trackItem, onDismiss, onUpdateChapters }) => {
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
          outlined
          keyboardType="number"
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
