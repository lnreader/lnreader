import React, { useState } from 'react';

import { Dialog } from '@components';
import { RadioButton, RadioButtonGroup } from '@components/RadioButton';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { UserListStatus } from '@services/Trackers';
import { STATUS_LABELS } from './constants';
import { TrackStatusDialogProps } from './types';

type SetTrackStatusDialogContentProps = Omit<TrackStatusDialogProps, 'visible'>;

const SetTrackStatusDialogContent: React.FC<
  SetTrackStatusDialogContentProps
> = ({ trackItem, onDismiss, onUpdateStatus }) => {
  const theme = useTheme();
  const [selectedStatus, setSelectedStatus] = useState(trackItem.status);

  const handleSave = () => {
    onUpdateStatus(selectedStatus);
    onDismiss();
  };

  const handleValueChange = (value: string) => {
    setSelectedStatus(value as UserListStatus);
  };

  return (
    <Dialog.Root visible onDismiss={onDismiss}>
      <Dialog.Title>Status</Dialog.Title>
      <Dialog.List>
        <RadioButtonGroup
          onValueChange={handleValueChange}
          value={selectedStatus}
        >
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <RadioButton key={key} value={key} label={label} theme={theme} />
          ))}
        </RadioButtonGroup>
      </Dialog.List>
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

const SetTrackStatusDialog: React.FC<TrackStatusDialogProps> = ({
  visible,
  ...props
}) => (visible ? <SetTrackStatusDialogContent {...props} /> : null);

export default SetTrackStatusDialog;
