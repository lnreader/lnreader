import React from 'react';

import { getString } from '@i18n/translations';

import { Dialog, DialogActionTone } from '../Dialog';

interface ConfirmationDialogProps {
  title: string;
  message?: string;
  visible: boolean;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: DialogActionTone;
  onConfirm: () => void | Promise<void>;
  onDismiss: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  title,
  message,
  visible,
  confirmLabel,
  cancelLabel = getString('common.cancel'),
  confirmTone = 'danger',
  onDismiss,
  onConfirm,
}) => {
  const handleConfirm = () => {
    void onConfirm();
    onDismiss();
  };

  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
        {message ? <Dialog.Description>{message}</Dialog.Description> : null}
      </Dialog.Header>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>{cancelLabel}</Dialog.Action>
        <Dialog.Action tone={confirmTone} onPress={handleConfirm}>
          {confirmLabel}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default ConfirmationDialog;
