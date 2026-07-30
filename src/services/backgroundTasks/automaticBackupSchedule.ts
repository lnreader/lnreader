import NativeBackgroundTasks from '@modules/native-background-tasks';
import { getString } from '@i18n/translations';
import { askForPostNotificationsPermission } from '@utils/askForPostNoftificationsPermission';

export const AUTOMATIC_BACKUP_INTERVALS = [0, 6, 12, 24, 48, 168] as const;

export type AutomaticBackupInterval =
  (typeof AUTOMATIC_BACKUP_INTERVALS)[number];

export const configureAutomaticBackups = async (
  intervalHours: AutomaticBackupInterval,
  directoryUri?: string,
) => {
  if (intervalHours === 0) {
    await NativeBackgroundTasks.cancelAutomaticBackups();
    return;
  }

  await askForPostNotificationsPermission();
  await NativeBackgroundTasks.scheduleAutomaticBackups(
    intervalHours,
    getString('notifications.LOCAL_BACKUP'),
    getString('common.preparing'),
    directoryUri ?? '',
  );
};
