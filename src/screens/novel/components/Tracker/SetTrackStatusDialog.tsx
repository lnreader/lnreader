import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Dialog, RadioButton } from '@components';
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

  return (
    <Dialog.Root visible onDismiss={onDismiss}>
      <Dialog.Title>Status</Dialog.Title>
      <Dialog.List>
        {(Object.entries(STATUS_LABELS) as [UserListStatus, string][]).map(
          ([key, label]) => (
            <RadioButton
              key={key}
              label={label}
              status={selectedStatus === key}
              onPress={() => setSelectedStatus(key)}
              style={styles.radio}
              labelStyle={styles.radioLabel}
              theme={theme}
            />
          ),
        )}
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

const styles = StyleSheet.create({
  radio: {
    paddingHorizontal: 24,
    paddingVertical: 2,
  },
  radioLabel: {
    fontSize: 16,
  },
});
