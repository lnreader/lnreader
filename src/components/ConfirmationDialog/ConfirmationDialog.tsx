import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getString } from '@strings/translations';

import { Dialog, Portal } from 'react-native-paper';
import { ThemeColors } from '../../theme/types';
import Button from '../Button/Button';

interface ConfirmationDialogProps {
  title?: string;
  message?: string;
  visible: boolean;
  theme: ThemeColors;
  onSubmit: () => void | Promise<void>;
  onDismiss: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  title = getString('common.warning'),
  message,
  visible,
  onDismiss,
  theme,
  onSubmit,
}) => {
  const handleOnSubmit = async () => {
    onDismiss();
    try {
      await onSubmit();
    } catch (error: any) {
      // Prevent unhandled promise rejections from crashing the app
      // eslint-disable-next-line no-console
      console.error('ConfirmationDialog onSubmit error:', error);
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.container, { backgroundColor: theme.overlay3 }]}
      >
        <Dialog.Title style={{ color: theme.onSurface }}>{title}</Dialog.Title>
        {message ? (
          <Dialog.Content>
            <Text style={[styles.content, { color: theme.onSurface }]}>
              {message}
            </Text>
          </Dialog.Content>
        ) : null}
        <View style={styles.buttonCtn}>
          <Button onPress={handleOnSubmit} title={getString('common.ok')} />
          <Button onPress={onDismiss} title={getString('common.cancel')} />
        </View>
      </Dialog>
    </Portal>
  );
};

export default ConfirmationDialog;

const styles = StyleSheet.create({
  buttonCtn: {
    flexDirection: 'row-reverse',
    padding: 16,
  },
  container: {
    borderRadius: 28,
    shadowColor: 'transparent',
  },
  content: {
    fontSize: 16,
    letterSpacing: 0,
  },
});
