import { getString } from '@i18n/translations';

export type BackupResult = {
  failedNovelCount: number;
  failedSectionCount: number;
};

export const getBackupCompletionText = (result: BackupResult) => {
  const warnings: string[] = [];

  if (result.failedNovelCount > 0) {
    warnings.push(
      getString('backupScreen.novelsBackupFailedSummary', {
        count: result.failedNovelCount,
      }),
    );
  }
  if (result.failedSectionCount > 0) {
    warnings.push(
      getString('backupScreen.sectionsBackupFailedSummary', {
        count: result.failedSectionCount,
      }),
    );
  }

  if (warnings.length === 0) {
    return getString('backupScreen.backupCreated');
  }

  return getString('backupScreen.backupCreatedWithWarnings', {
    warnings: warnings.join('; '),
  });
};
