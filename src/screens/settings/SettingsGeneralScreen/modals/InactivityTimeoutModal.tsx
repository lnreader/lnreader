import React from 'react';

import { Dialog, RadioButton } from '@components';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';

interface InactivityTimeoutModalProps {
  inactivityTimeoutMs: number | undefined;
  modalVisible: boolean;
  hideModal: () => void;
  theme: ThemeColors;
}

const InactivityTimeoutModal: React.FC<InactivityTimeoutModalProps> = ({
  theme,
  inactivityTimeoutMs,
  hideModal,
  modalVisible,
}) => {
  const { setAppSettings } = useAppSettings();

  return (
    <Dialog.Root visible={modalVisible} onDismiss={hideModal}>
      <Dialog.Header>
        <Dialog.Title>
          {getString('generalSettingsScreen.inactivityTimeout')}
        </Dialog.Title>
        <Dialog.Description>
          {getString('generalSettingsScreen.inactivityTimeoutDesc')}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.List>
        <RadioButton
          key={0}
          status={inactivityTimeoutMs === undefined}
          label={getString('generalSettingsScreen.inactivityTimeoutNever')}
          onPress={() => setAppSettings({ inactivityTimeoutMs: undefined })}
          theme={theme}
        />
        {[1, 3, 5, 10, 15, 30].map(time => (
          <RadioButton
            key={time}
            status={inactivityTimeoutMs === time * 60 * 1000}
            onPress={() =>
              setAppSettings({ inactivityTimeoutMs: time * 60 * 1000 })
            }
            label={`${getString('time.minutes', { count: time })}`}
            theme={theme}
          />
        ))}
      </Dialog.List>
    </Dialog.Root>
  );
};

export default InactivityTimeoutModal;
