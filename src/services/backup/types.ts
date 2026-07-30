import type { BackupOptions } from './options';

export enum ZipBackupName {
  DATA = 'data.zip',
  DOWNLOAD = 'download.zip',
  NOVEL_FILES = 'novel-files.zip',
  PLUGINS = 'plugins.zip',
}

export enum BackupEntryName {
  VERSION = 'Version.json',
  CATEGORY = 'Category.json',
  SETTING = 'Setting.json',
  PLUGIN_METADATA = 'Plugins.json',
  NOVEL_AND_CHAPTERS = 'NovelAndChapters',
}

export type BackupManifest = {
  appVersion: string;
  formatVersion: 2;
  sections: BackupOptions;
};

export type ResolvedBackupManifest =
  | BackupManifest
  | {
      appVersion?: string;
      formatVersion: 1;
      sections: BackupOptions;
    };
