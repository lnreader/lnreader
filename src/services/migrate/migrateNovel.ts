import { ChapterInfo } from '@database/types';
import {
  getNovelById,
  getNovelByPath,
  insertNovelAndChapters,
} from '@database/queries/NovelQueries';
import { getAllNovelChapters } from '@database/queries/ChapterQueries';

import { fetchNovel } from '@services/plugin/fetch';
import { parseChapterNumber } from '@utils/parseChapterNumber';

import {
  novelPersistence,
  type NovelPersistenceInput,
} from '@hooks/persisted/useNovel/store-helper/contracts';
import type {
  BackgroundTaskEnqueuer,
  ChapterDownload,
  MigrateNovelData,
  MigrationNovelOptions,
  MigrationNovelPreference,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { dbManager } from '@database/db';
import {
  createNovelTriggerQueryDelete,
  createNovelTriggerQueryUpdate,
} from '@database/queryStrings/triggers';
import { getString } from '@i18n/translations';

const sortChaptersByNumber = (novelName: string, chapters: ChapterInfo[]) => {
  for (let i = 0; i < chapters.length; ++i) {
    if (!chapters[i].chapterNumber) {
      chapters[i].chapterNumber = parseChapterNumber(
        novelName,
        chapters[i].name,
      );
    }
  }
  return chapters.sort((a, b) => {
    if (a.chapterNumber && b.chapterNumber) {
      return a.chapterNumber - b.chapterNumber;
    }
    return 0;
  });
};

// Both flags are nullable columns: keep NULL rather than coercing it to 0.
const toDbFlag = (value: boolean | null | undefined) =>
  value === null || value === undefined ? null : value ? 1 : 0;

export type ChapterMatch = { from: ChapterInfo; to: ChapterInfo };

/**
 * Pairs chapters of the current and destination novel by chapter number.
 * Chapters without a number are never paired.
 */
export const matchChapters = (
  fromNovelName: string,
  fromChapters: ChapterInfo[],
  toNovelName: string,
  toChapters: ChapterInfo[],
): ChapterMatch[] => {
  const sortedFrom = sortChaptersByNumber(fromNovelName, fromChapters);
  const sortedTo = sortChaptersByNumber(toNovelName, toChapters);

  const matches: ChapterMatch[] = [];
  let fromPointer = 0,
    toPointer = 0;
  while (fromPointer < sortedFrom.length && toPointer < sortedTo.length) {
    const from = sortedFrom[fromPointer];
    const to = sortedTo[toPointer];
    if (from.chapterNumber && to.chapterNumber) {
      if (from.chapterNumber < to.chapterNumber) {
        ++fromPointer;
        continue;
      }
      if (from.chapterNumber > to.chapterNumber) {
        ++toPointer;
        continue;
      }
    } else {
      ++fromPointer;
      ++toPointer;
      continue;
    }

    matches.push({ from, to });
    ++fromPointer;
    ++toPointer;
  }
  return matches;
};

const LEGACY_MIGRATION_OPTIONS: MigrationNovelOptions = {
  cover: 'current',
  metadata: 'current',
  redownloadChapters: true,
};

const selectMigrationValue = (
  currentValue: string | null | undefined,
  destinationValue: string | null | undefined,
  preference: MigrationNovelPreference,
) =>
  preference === 'destination'
    ? destinationValue || currentValue || ''
    : currentValue || destinationValue || '';

export const migrateNovel = async (
  {
    pluginId,
    fromNovel,
    toNovelPath,
    options = LEGACY_MIGRATION_OPTIONS,
  }: MigrateNovelData,
  setMeta: TaskProgressUpdater,
  enqueue: BackgroundTaskEnqueuer,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
  }));

  // A repeated or stale task must not resurrect or overwrite from a novel
  // that an earlier migration already consumed.
  if (!getNovelById(fromNovel.id)) {
    throw new Error(`Novel ${fromNovel.id} no longer exists`);
  }

  const fromChapters = await getAllNovelChapters(fromNovel.id);
  let toNovel = await getNovelByPath(toNovelPath, pluginId);
  if (!toNovel) {
    const fetchedNovel = await fetchNovel(pluginId, toNovelPath);
    await insertNovelAndChapters(pluginId, fetchedNovel);
    toNovel = await getNovelByPath(toNovelPath, pluginId);
  }
  if (!toNovel) {
    throw new Error(`Could not load ${toNovelPath} from ${pluginId}`);
  }
  const destination = toNovel;
  const toChapters = await getAllNovelChapters(destination.id);

  const matches = matchChapters(
    fromNovel.name,
    fromChapters,
    destination.name,
    toChapters,
  );

  // One transaction, with the source novel deleted last: a failure rolls
  // everything back and leaves the source novel and its progress untouched.
  // writeRaw, not write: Drizzle's op-sqlite transaction commits before an
  // async body finishes, so it would not roll anything back.
  await dbManager.writeRaw(async tx => {
    await tx.execute(
      `UPDATE Novel
       SET cover = ?, summary = ?, author = ?, artist = ?, status = ?,
           genres = ?, inLibrary = 1
       WHERE id = ?`,
      [
        selectMigrationValue(fromNovel.cover, destination.cover, options.cover),
        selectMigrationValue(
          fromNovel.summary,
          destination.summary,
          options.metadata,
        ),
        selectMigrationValue(
          fromNovel.author,
          destination.author,
          options.metadata,
        ),
        selectMigrationValue(
          fromNovel.artist,
          destination.artist,
          options.metadata,
        ),
        selectMigrationValue(
          fromNovel.status,
          destination.status,
          options.metadata,
        ),
        selectMigrationValue(
          fromNovel.genres,
          destination.genres,
          options.metadata,
        ),
        destination.id,
      ],
    );
    // OR IGNORE: the destination may already sit in one of the same categories.
    await tx.execute(
      'UPDATE OR IGNORE NovelCategory SET novelId = ? WHERE novelId = ?',
      [destination.id, fromNovel.id],
    );
    await tx.execute('DELETE FROM NovelCategory WHERE novelId = ?', [
      fromNovel.id,
    ]);
    // Both triggers recompute the novel's counters once per chapter row, which
    // is quadratic here. Dropping them is rolled back with the transaction.
    await tx.execute('DROP TRIGGER IF EXISTS update_novel_stats_on_update');
    await tx.execute('DROP TRIGGER IF EXISTS update_novel_stats_on_delete');
    for (const { from, to } of matches) {
      await tx.execute(
        `UPDATE Chapter
         SET bookmark = ?, unread = ?, readTime = ?, progress = ?
         WHERE id = ?`,
        [
          toDbFlag(from.bookmark),
          toDbFlag(from.unread),
          from.readTime ?? null,
          from.progress ?? null,
          to.id,
        ],
      );
    }
    await tx.execute('DELETE FROM Chapter WHERE novelId = ?', [fromNovel.id]);
    const { rowsAffected } = await tx.execute(
      'DELETE FROM Novel WHERE id = ?',
      [fromNovel.id],
    );
    if (!rowsAffected) {
      throw new Error(`Novel ${fromNovel.id} no longer exists`);
    }
    await tx.execute(createNovelTriggerQueryUpdate);
    await tx.execute(createNovelTriggerQueryDelete);
    if (matches.length) {
      // No-op write that fires the restored trigger once, refreshing the
      // destination's counters from the migrated chapters.
      await tx.execute('UPDATE Chapter SET unread = unread WHERE id = ?', [
        matches[0].to.id,
      ]);
    }
  });

  const fromPersistenceInput: NovelPersistenceInput = {
    pluginId: fromNovel.pluginId,
    novelPath: fromNovel.path,
  };
  const toPersistenceInput: NovelPersistenceInput = {
    pluginId: destination.pluginId,
    novelPath: destination.path,
  };

  novelPersistence.copySettings(fromPersistenceInput, toPersistenceInput);

  const lastRead = novelPersistence.readLastRead(fromPersistenceInput);
  const lastReadMatch = lastRead
    ? matches.find(({ from }) => from.id === lastRead.id)
    : undefined;
  if (lastReadMatch) {
    novelPersistence.writeLastRead(toPersistenceInput, lastReadMatch.to);
  }

  const chaptersToDownload: ChapterDownload[] = options.redownloadChapters
    ? matches
        .filter(({ from }) => from.isDownloaded)
        .map(({ to }) => ({ chapterId: to.id, chapterName: to.name }))
    : [];

  if (chaptersToDownload.length) {
    enqueue({
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: destination.name,
        novelId: destination.id,
        pluginId: destination.pluginId,
        chapters: chaptersToDownload,
      },
    });
  }

  const matchedFromIds = new Set(matches.map(({ from }) => from.id));
  const unmatchedReadChapters = fromChapters.filter(
    chapter => chapter.unread === false && !matchedFromIds.has(chapter.id),
  ).length;

  setMeta(meta => ({
    ...meta,
    isRunning: false,
    completionText: unmatchedReadChapters
      ? getString('browseScreen.migration.unmatchedReadChapters', {
          count: unmatchedReadChapters,
        })
      : meta.completionText,
  }));
};
