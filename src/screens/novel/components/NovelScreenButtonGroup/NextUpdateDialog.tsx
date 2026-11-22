import { Dialog } from '@components';
import { getString } from '@i18n/translations';

interface NextUpdateDialogProps {
  visible: boolean;
  onDismiss: () => void;
  /** Days until the predicted next update, or null when there is no prediction. */
  daysUntilUpdate: number | null;
  fetchInterval: number;
}

const NextUpdateDialog = ({
  visible,
  onDismiss,
  daysUntilUpdate,
  fetchInterval,
}: NextUpdateDialogProps) => (
  <Dialog.Root visible={visible} onDismiss={onDismiss}>
    <Dialog.Title>
      {getString('generalSettingsScreen.smartUpdate')}
    </Dialog.Title>
    <Dialog.Content>
      <Dialog.Description>
        {daysUntilUpdate !== null && fetchInterval >= 0
          ? getString('novelScreen.nextUpdate.expected', {
              nextUpdate: getString('time.days', { count: daysUntilUpdate }),
              interval: getString('time.days', {
                count: Math.abs(fetchInterval),
              }),
            })
          : getString('novelScreen.nextUpdate.expectedNull')}
      </Dialog.Description>
    </Dialog.Content>
    <Dialog.Actions>
      <Dialog.Action title={getString('common.cancel')} onPress={onDismiss} />
      <Dialog.Action title={getString('common.ok')} onPress={onDismiss} />
    </Dialog.Actions>
  </Dialog.Root>
);

export default NextUpdateDialog;
