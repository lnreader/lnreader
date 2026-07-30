export type BackupOptions = {
  library: boolean;
  settings: boolean;
  plugins: boolean;
  downloadedFiles: boolean;
};

export const DEFAULT_BACKUP_OPTIONS: BackupOptions = {
  library: true,
  settings: true,
  plugins: true,
  downloadedFiles: true,
};

export const resolveBackupOptions = (
  options?: BackupOptions,
): BackupOptions => {
  const resolved = {
    ...DEFAULT_BACKUP_OPTIONS,
    ...options,
  };

  return {
    ...resolved,
    downloadedFiles: resolved.library && resolved.downloadedFiles,
  };
};

export const hasSelectedBackupOption = (options: BackupOptions) =>
  Object.values(options).some(Boolean);

export const areAllBackupOptionsSelected = (options: BackupOptions) =>
  Object.values(options).every(Boolean);
