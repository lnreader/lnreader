import { StyleSheet, useWindowDimensions } from 'react-native';
import * as Linking from 'expo-linking';
import { ScrollView } from 'react-native-gesture-handler';

import { getString } from '@i18n/translations';

import { Dialog } from '../Dialog';
import type { AppRelease } from './useAppUpdateChecker';

interface AppUpdateDialogProps {
  release: AppRelease;
  onDismiss: () => void;
  onIgnore: () => void;
}

const AppUpdateDialog = ({
  release,
  onDismiss,
  onIgnore,
}: AppUpdateDialogProps) => {
  const maxContentHeight = useWindowDimensions().height / 2;

  const installUpdate = () => {
    if (release.downloadUrl) {
      void Linking.openURL(release.downloadUrl);
    }
  };

  return (
    <Dialog.Root visible onDismiss={onDismiss}>
      <Dialog.Title>
        {`${getString('common.newUpdateAvailable')} ${release.tag_name}`}
      </Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          style={{ maxHeight: maxContentHeight }}
          testID="app-update-release-notes"
        >
          <Dialog.Description>{release.body.trim()}</Dialog.Description>
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action title={getString('common.later')} onPress={onDismiss} />
        <Dialog.Action
          title={getString('common.skipVersion')}
          onPress={onIgnore}
        />
        <Dialog.Action
          title={getString('common.install')}
          disabled={!release.downloadUrl}
          onPress={installUpdate}
        />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default AppUpdateDialog;

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
});
