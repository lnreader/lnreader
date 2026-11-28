import { create, list } from './request';
import { DriveCreateRequestData, DriveFile } from './types';

const LNREADER_DRIVE_MARK = '(Do not change this!) LNReader-Drive';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
export const DRIVE_ROOT_FOLDER_NAME = 'LNReader';
const BACKUP_FOLDER_SUFFIX = '.backup';

export const escapeQueryValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const listAll = async (q: string, orderBy?: string) => {
  let files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await list({ q, orderBy, pageSize: 1000, pageToken });
    files = files.concat(res.files);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return files;
};

/** Newest first, so a folder holding duplicates resolves to the latest upload. */
export const findFiles = async (
  fileName: string,
  isFolder?: boolean,
  parentId?: string,
) => {
  let q = `name = '${escapeQueryValue(fileName)}' and trashed = false`;
  if (isFolder) {
    q += ` and mimeType = '${FOLDER_MIME_TYPE}'`;
  }
  if (parentId) {
    q += ` and '${escapeQueryValue(parentId)}' in parents`;
  }
  const files = await listAll(q, 'createdTime desc');
  return files.filter(file => file.name === fileName);
};

export const exists = async (
  fileName: string,
  isFolder?: boolean,
  parentId?: string,
) => {
  const files = await findFiles(fileName, isFolder, parentId);
  return files[0] as DriveFile | undefined;
};

export const makeDir = async (fileName: string, parentId?: string) => {
  const existedDir = await exists(fileName, true, parentId);
  if (existedDir) {
    return existedDir;
  }
  const data: DriveCreateRequestData = {
    metadata: {
      name: fileName,
      mimeType: FOLDER_MIME_TYPE,
      description: LNREADER_DRIVE_MARK,
    },
  };
  if (parentId) {
    data.metadata.parents = [parentId];
  }
  return create(data);
};

export const createFile = async (
  fileName: string,
  mimeType: string,
  content: string,
  parentId?: string,
) => {
  const existedFile = await exists(fileName, false, parentId);
  if (existedFile) {
    return existedFile;
  }
  const data: DriveCreateRequestData = {
    metadata: {
      name: fileName,
      mimeType: mimeType,
      description: LNREADER_DRIVE_MARK,
    },
    content: content,
  };
  if (parentId) {
    data.metadata.parents = [parentId];
  }
  return create(data);
};

/**
 * Lists backup folders across every `LNReader` root the app can see, newest
 * first. Earlier versions could create more than one root, and the suffix is
 * matched here because Drive's `name contains` only matches word prefixes.
 */
export const getBackups = async () => {
  const roots = await findFiles(DRIVE_ROOT_FOLDER_NAME, true);
  const backups = (
    await Promise.all(
      roots.map(root =>
        listAll(
          `mimeType = '${FOLDER_MIME_TYPE}' and trashed = false` +
            ` and '${escapeQueryValue(root.id)}' in parents`,
        ),
      ),
    )
  )
    .flat()
    .filter(folder => folder.name.endsWith(BACKUP_FOLDER_SUFFIX));
  return backups.sort((a, b) =>
    (b.createdTime ?? '').localeCompare(a.createdTime ?? ''),
  );
};

export const readDir = async (parentId: string) => {
  return listAll(
    `trashed = false and mimeType != '${FOLDER_MIME_TYPE}'` +
      ` and '${escapeQueryValue(parentId)}' in parents`,
  );
};
