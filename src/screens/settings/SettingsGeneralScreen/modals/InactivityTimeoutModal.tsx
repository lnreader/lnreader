import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { Portal } from 'react-native-paper';

import { RadioButton } from '@components/RadioButton/RadioButton';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { Modal } from '@components';

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
    <Portal>
      <Modal visible={modalVisible} onDismiss={hideModal}>
        <Text style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.inactivityTimeout')}
        </Text>
        <Text style={{ color: theme.onSurface }}>
          {getString('generalSettingsScreen.inactivityTimeoutDesc')}
        </Text>
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
            onPress={() => setAppSettings({ inactivityTimeoutMs: time * 60 * 1000 })}
            label={`${getString('time.minutes', { count: time })}`}
            theme={theme}
          />
        ))}
      </Modal>
    </Portal>
  );
};

export default InactivityTimeoutModal;

const styles = StyleSheet.create({
  modalHeader: {
    fontSize: 24,
    marginBottom: 10,
  },
});
