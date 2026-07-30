import { getBackupCompletionText, type BackupResult } from '../backupResult';

jest.mock('@i18n/translations', () => ({
  getString: (key: string, options?: Record<string, string | number>) => {
    const strings: Record<string, string> = {
      'backupScreen.backupCreated': 'Backup created successfully',
      'backupScreen.backupCreatedWithWarnings':
        'Backup created with warnings: %{warnings}',
    };
    const pluralStrings: Record<string, [string, string]> = {
      'backupScreen.novelsBackupFailedSummary': [
        '%{count} novel failed',
        '%{count} novels failed',
      ],
      'backupScreen.sectionsBackupFailedSummary': [
        '%{count} backup section failed',
        '%{count} backup sections failed',
      ],
    };
    const pluralString = pluralStrings[key];
    const template = pluralString
      ? pluralString[options?.count === 1 ? 0 : 1]
      : strings[key] ?? key;

    return Object.entries(options ?? {}).reduce(
      (text, [name, value]) => text.replace(`%{${name}}`, String(value)),
      template,
    );
  },
}));

describe('backup result notifications', () => {
  it('uses a concise success message when every section is backed up', () => {
    const result: BackupResult = {
      failedNovelCount: 0,
      failedSectionCount: 0,
    };

    expect(getBackupCompletionText(result)).toBe('Backup created successfully');
  });

  it('aggregates partial backup failures', () => {
    expect(
      getBackupCompletionText({
        failedNovelCount: 2,
        failedSectionCount: 1,
      }),
    ).toBe(
      'Backup created with warnings: 2 novels failed; 1 backup section failed',
    );
  });
});
