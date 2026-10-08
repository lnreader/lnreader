import * as Linking from 'expo-linking';

import { getString } from '@i18n/translations';

import { Dialog } from '../Dialog';
import OverlayHost from '../OverlayHost/OverlayHost';
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
  const installUpdate = () => {
    if (release.downloadUrl) {
      void Linking.openURL(release.downloadUrl);
    }
  };

  return (
    // Rendered outside any screen, so it needs its own Compose host.
    <OverlayHost>
      <Dialog.Root visible onDismiss={onDismiss}>
        <Dialog.Title>
          {`${getString('common.newUpdateAvailable')} ${release.tag_name}`}
        </Dialog.Title>
        <Dialog.ScrollArea>
          <Dialog.Description>{release.body.trim()}</Dialog.Description>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Dialog.Action
            title={getString('common.later')}
            onPress={onDismiss}
          />
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
    </OverlayHost>
  );
};

export default AppUpdateDialog;
