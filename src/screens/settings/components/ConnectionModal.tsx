import { Dialog, TextInput } from '@components';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import React from 'react';

interface ConnectionModalProps {
  title: string;
  ipv4: string;
  port: string;
  visible: boolean;
  theme: ThemeColors;
  closeModal: () => void;
  handle: (ipv4: string, port: string) => Promise<void>;
  setIpv4: React.Dispatch<React.SetStateAction<string>>;
  setPort: React.Dispatch<React.SetStateAction<string>>;
}

const ConnectionModal: React.FC<ConnectionModalProps> = ({
  title,
  ipv4,
  port,
  visible,
  theme,
  closeModal,
  handle,
  setIpv4,
  setPort,
}) => {
  return (
    <Dialog.Root visible={visible} onDismiss={closeModal}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Content>
        <TextInput
          value={ipv4}
          placeholder={'xxx.xxx.xxx.xxx'}
          onChangeText={setIpv4}
        />
        <TextInput value={port} onChangeText={setPort} />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={closeModal}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action
          onPress={() => {
            closeModal();
            void handle(ipv4, port);
          }}
        >
          {getString('common.ok')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default ConnectionModal;
