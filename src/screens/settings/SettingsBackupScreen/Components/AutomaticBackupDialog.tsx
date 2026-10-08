import { Dialog, RadioButton } from '@components';
import { getString } from '@i18n/translations';
import type { StringMap } from '@i18n/types';
import {
  AUTOMATIC_BACKUP_INTERVALS,
  type AutomaticBackupInterval,
} from '@services/backgroundTasks';
import { useTheme } from '@hooks/persisted';

type AutomaticBackupLabel = Extract<
  keyof StringMap,
  `backupScreen.automaticBackup${string}`
>;

export const AUTOMATIC_BACKUP_LABELS: Record<
  AutomaticBackupInterval,
  AutomaticBackupLabel
> = {
  0: 'backupScreen.automaticBackupOff',
  6: 'backupScreen.automaticBackupEvery6Hours',
  12: 'backupScreen.automaticBackupEvery12Hours',
  24: 'backupScreen.automaticBackupDaily',
  48: 'backupScreen.automaticBackupEvery2Days',
  168: 'backupScreen.automaticBackupWeekly',
};

interface AutomaticBackupDialogProps {
  intervalHours: AutomaticBackupInterval;
  visible: boolean;
  onCancel: () => void;
  onSelect: (interval: AutomaticBackupInterval) => void | Promise<void>;
}

const AutomaticBackupDialog = ({
  intervalHours,
  visible,
  onCancel,
  onSelect,
}: AutomaticBackupDialogProps) => {
  const theme = useTheme();
  return (
    <Dialog.Root visible={visible} onDismiss={onCancel}>
      <Dialog.Title>
        {getString('backupScreen.automaticBackupFrequency')}
      </Dialog.Title>
      <Dialog.Description>
        {getString('backupScreen.automaticBackupDescription')}
      </Dialog.Description>
      <Dialog.ScrollArea>
        {AUTOMATIC_BACKUP_INTERVALS.map(item => (
          <RadioButton
            key={item.toString()}
            label={getString(AUTOMATIC_BACKUP_LABELS[item])}
            status={item === intervalHours}
            onPress={() => onSelect(item)}
            theme={theme}
          />
        ))}
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={onCancel}>
          {getString('common.cancel')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default AutomaticBackupDialog;
