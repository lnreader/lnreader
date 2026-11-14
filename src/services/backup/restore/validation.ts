import type { BackupNovel } from '@database/types';
import { ROOT_STORAGE } from '@utils/Storages';
import { decodeNovelBatch, normalizeLegacyNovel } from '../novelPayload';
import type { ResolvedBackupManifest } from '../types';

const APP_STORAGE_URI = 'file://' + ROOT_STORAGE;

export class NovelFileValidationError extends Error {
  recordCount: number;

  constructor(recordCount: number, cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Invalid novel file');
    this.name = 'NovelFileValidationError';
    this.recordCount = recordCount;
  }
}

export const decodeRestoreNovelFile = (
  payload: unknown,
  manifest: ResolvedBackupManifest,
) => {
  const novels =
    manifest.novelDataFormat === 2
      ? decodeNovelBatch(payload)
      : [normalizeLegacyNovel(payload)];
  return novels.map(novel => {
    const {
      chaptersDownloaded: _chaptersDownloaded,
      chaptersUnread: _chaptersUnread,
      totalChapters: _totalChapters,
      lastReadAt: _lastReadAt,
      lastUpdatedAt: _lastUpdatedAt,
      ...normalized
    } = novel as BackupNovel & {
      chaptersDownloaded?: number | null;
      chaptersUnread?: number | null;
      totalChapters?: number | null;
      lastReadAt?: string | null;
      lastUpdatedAt?: string | null;
    };
    return normalized.cover && !normalized.cover.startsWith('http')
      ? { ...normalized, cover: APP_STORAGE_URI + normalized.cover }
      : normalized;
  });
};

export const getNovelFileRecordCount = (
  payload: unknown,
  manifest: ResolvedBackupManifest,
) => {
  if (manifest.novelDataFormat !== 2) {
    return 1;
  }
  return Array.isArray(payload) ? Math.max(1, payload.length) : 1;
};

export const validateNovelFileRecords = (
  novels: BackupNovel[],
  seenNovelIds: Set<number>,
  seenNovelIdentities: Set<string>,
  seenChapterIdentities: Set<string>,
) => {
  const fileNovelIds = new Set<number>();
  const fileNovelIdentities = new Set<string>();
  const fileChapterIdentities = new Set<string>();
  for (const novel of novels) {
    const novelIdentity = `${novel.pluginId}\u0000${novel.path}`;
    if (
      fileNovelIds.has(novel.id) ||
      seenNovelIds.has(novel.id) ||
      fileNovelIdentities.has(novelIdentity) ||
      seenNovelIdentities.has(novelIdentity)
    ) {
      throw new Error('Duplicate backup novel identity');
    }
    fileNovelIds.add(novel.id);
    fileNovelIdentities.add(novelIdentity);
    for (const chapter of novel.chapters) {
      const chapterIdentity = `${novel.id}\u0000${chapter.path}`;
      if (
        fileChapterIdentities.has(chapterIdentity) ||
        seenChapterIdentities.has(chapterIdentity)
      ) {
        throw new Error('Duplicate backup chapter identity');
      }
      fileChapterIdentities.add(chapterIdentity);
    }
  }
  for (const novelId of fileNovelIds) {
    seenNovelIds.add(novelId);
  }
  for (const novelIdentity of fileNovelIdentities) {
    seenNovelIdentities.add(novelIdentity);
  }
  for (const chapterIdentity of fileChapterIdentities) {
    seenChapterIdentities.add(chapterIdentity);
  }
};

export const decodeAndValidateNovelFile = (
  fileContent: string,
  manifest: ResolvedBackupManifest,
  seenNovelIds: Set<number>,
  seenNovelIdentities: Set<string>,
  seenChapterIdentities: Set<string>,
) => {
  let payload: unknown;
  try {
    payload = JSON.parse(fileContent);
  } catch (error) {
    throw new NovelFileValidationError(1, error);
  }

  const recordCount = getNovelFileRecordCount(payload, manifest);
  try {
    const novels = decodeRestoreNovelFile(payload, manifest);
    validateNovelFileRecords(
      novels,
      seenNovelIds,
      seenNovelIdentities,
      seenChapterIdentities,
    );
    return novels;
  } catch (error) {
    throw new NovelFileValidationError(recordCount, error);
  }
};
