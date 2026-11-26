import { APP_SETTINGS } from '@hooks/persisted/useSettings';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { createBackup } from '@services/backup/local';
import type { BackupOptions } from '@services/backup/options';
import { executeBackgroundTask } from '../executeTask';

jest.mock('@services/backup/local', () => ({
  createBackup: jest.fn(),
}));
jest.mock('@services/backup/drive', () => ({}));
jest.mock('@services/backup/selfhost', () => ({}));
jest.mock('@services/download/downloadChapter', () => ({}));
jest.mock('@services/epub/export', () => ({}));
jest.mock('@services/epub/import', () => ({}));
jest.mock('@services/migrate/migrateNovel', () => ({}));
jest.mock('@services/updates', () => ({}));

const savedOptions: BackupOptions = {
  library: true,
  settings: true,
  plugins: false,
  downloadedFiles: false,
};
const destinationUri = 'file://backup.zip';
const updateProgress = jest.fn();
const context = { updateCheckpoint: jest.fn(), postWarning: jest.fn() };

describe('local backup task execution', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setMMKVObject(APP_SETTINGS, {});
  });

  it('uses the saved options when the automatic backup runs and preserves later edits', async () => {
    const newerOptions = { ...savedOptions, settings: false };
    setMMKVObject(APP_SETTINGS, { automaticBackupOptions: savedOptions });
    jest.mocked(createBackup).mockImplementationOnce(async () => {
      setMMKVObject(APP_SETTINGS, { automaticBackupOptions: newerOptions });
    });

    const data = { automatic: true, destinationUri };
    await executeBackgroundTask(
      { name: 'LOCAL_BACKUP', data },
      updateProgress,
      jest.fn(),
      context,
    );

    expect(createBackup).toHaveBeenCalledWith(
      { ...data, options: savedOptions },
      updateProgress,
    );
    expect(getMMKVObject(APP_SETTINGS)).toEqual({
      automaticBackupOptions: newerOptions,
      lastAutomaticBackupAt: expect.any(Number),
    });
  });

  it('uses the archive builder defaults for an existing automatic backup schedule', async () => {
    const data = { automatic: true, destinationUri };
    await executeBackgroundTask(
      { name: 'LOCAL_BACKUP', data },
      updateProgress,
      jest.fn(),
      context,
    );

    expect(createBackup).toHaveBeenCalledWith(
      { ...data, options: undefined },
      updateProgress,
    );
  });

  it('uses the manual backup selection independently of the saved options', async () => {
    setMMKVObject(APP_SETTINGS, { automaticBackupOptions: savedOptions });
    const data = {
      destinationUri,
      options: { ...savedOptions, plugins: true },
    };

    await executeBackgroundTask(
      { name: 'LOCAL_BACKUP', data },
      updateProgress,
      jest.fn(),
      context,
    );

    expect(createBackup).toHaveBeenCalledWith(data, updateProgress);
    expect(getMMKVObject(APP_SETTINGS)).toEqual({
      automaticBackupOptions: savedOptions,
    });
  });
});
