import React, { useState } from 'react';

import { getString } from '@i18n/translations';

import { Dialog, DialogActionTone } from '../Dialog';

interface ConfirmationDialogProps {
  title: string;
  message?: string;
  visible: boolean;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: DialogActionTone;
  confirmFirst?: boolean;
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
  confirmFirst = false,
  onDismiss,
  onConfirm,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onDismiss();
    } finally {
      setIsConfirming(false);
    }
  };

  const cancelAction = (
    <Dialog.Action key="cancel" disabled={isConfirming} onPress={onDismiss}>
      {cancelLabel}
    </Dialog.Action>
  );
  const confirmAction = (
    <Dialog.Action
      key="confirm"
      disabled={isConfirming}
      loading={isConfirming}
      tone={confirmTone}
      onPress={handleConfirm}
    >
      {confirmLabel}
    </Dialog.Action>
  );

  return (
    <Dialog.Root
      visible={visible}
      onDismiss={isConfirming ? () => {} : onDismiss}
    >
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
        {message ? <Dialog.Description>{message}</Dialog.Description> : null}
      </Dialog.Header>
      <Dialog.Actions>
        {confirmFirst
          ? [confirmAction, cancelAction]
          : [cancelAction, confirmAction]}
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default ConfirmationDialog;
