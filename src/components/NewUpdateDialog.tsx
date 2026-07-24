import React, { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import * as Linking from 'expo-linking';
import { ScrollView } from 'react-native-gesture-handler';
import { getString } from '@i18n/translations';

import { useTheme } from '@hooks/persisted';
import { Dialog } from '@components';

interface NewUpdateDialogProps {
  newVersion: {
    tag_name: string;
    body: string;
    downloadUrl: string;
  };
}

const NewUpdateDialog: React.FC<NewUpdateDialogProps> = ({ newVersion }) => {
  const [newUpdateDialog, showNewUpdateDialog] = useState(true);

  const theme = useTheme();

  const modalHeight = useWindowDimensions().height / 2;

  return (
    <Dialog.Root
      visible={newUpdateDialog}
      onDismiss={() => showNewUpdateDialog(false)}
    >
      <Dialog.Title>
        {`${getString('common.newUpdateAvailable')} ${newVersion.tag_name}`}
      </Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          style={{ height: modalHeight }}
        >
          <Text style={[styles.body, { color: theme.onSurfaceVariant }]}>
            {newVersion.body.split('\n').join('\n\n')}
          </Text>
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action
          title={getString('common.cancel')}
          onPress={() => showNewUpdateDialog(false)}
        />
        <Dialog.Action
          title={getString('common.install')}
          onPress={() => Linking.openURL(newVersion.downloadUrl)}
        />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default NewUpdateDialog;

const styles = StyleSheet.create({
  body: {
    fontSize: 15,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
});
