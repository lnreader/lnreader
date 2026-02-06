import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Portal } from 'react-native-paper';

import { Button, Modal } from '@components/index';

import { Repository } from '@database/types';
import { deleteRepositoryById } from '@database/queries/RepositoryQueries';
import { useTheme } from '@hooks/persisted';

import { getString } from '@strings/translations';

interface DeleteRepositoryModalProps {
  repository: Repository;
  visible: boolean;
  closeModal: () => void;
  onSuccess: () => void;
}

const DeleteRepositoryModal: React.FC<DeleteRepositoryModalProps> = ({
  repository,
  closeModal,
  visible,
  onSuccess,
}) => {
  const theme = useTheme();
  return (
    <Portal>
      <Modal visible={visible} onDismiss={closeModal}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {'Delete repository'}
        </Text>
        <Text style={[styles.modalDesc, { color: theme.onSurfaceVariant }]}>
          {`Do you wish to delete repository "${repository.url}"?`}
        </Text>
        <View style={styles.btnContainer}>
          <Button
            title={getString('common.ok')}
            onPress={async () => {
              await deleteRepositoryById(repository.id);
              closeModal();
              onSuccess();
            }}
          />
          <Button title={getString('common.cancel')} onPress={closeModal} />
        </View>
      </Modal>
    </Portal>
  );
};

export default DeleteRepositoryModal;

const styles = StyleSheet.create({
  btnContainer: {
    flexDirection: 'row-reverse',
    marginTop: 24,
  },
  modalDesc: {},
  modalTitle: {
    fontSize: 24,
    marginBottom: 16,
  },
});
