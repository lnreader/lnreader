import * as DocumentPicker from 'expo-document-picker';

import { fetchNovel } from '@services/plugin/fetch';
import { insertChapters } from './ChapterQueries';

import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { BackupNovel, NovelInfo } from '../types';
import { SourceNovel } from '@plugins/types';
import { NOVEL_STORAGE } from '@utils/Storages';
import { downloadFile } from '@plugins/helpers/fetch';
import { getPlugin } from '@plugins/pluginManager';
import { db } from '@database/db';
import NativeFile from '@specs/NativeFile';

export const insertNovelAndChapters = async (
  pluginId: string,
  sourceNovel: SourceNovel,
): Promise<number | undefined> => {
  const insertNovelQuery =
    'INSERT OR IGNORE INTO Novel (path, pluginId, name, cover, summary, author, artist, status, genres, totalPages) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const novelId: number | undefined = db.runSync(insertNovelQuery, [
    sourceNovel.path,
    pluginId,
    sourceNovel.name,
    sourceNovel.cover || null,
    sourceNovel.summary || null,
    sourceNovel.author || null,
    sourceNovel.artist || null,
    sourceNovel.status || null,
    sourceNovel.genres || null,
    sourceNovel.totalPages || 0,
  ]).lastInsertRowId;

  if (novelId) {
    if (sourceNovel.cover) {
      const novelDir = NOVEL_STORAGE + '/' + pluginId + '/' + novelId;
      NativeFile.mkdir(novelDir);
      const novelCoverPath = novelDir + '/cover.png';
      const novelCoverUri = 'file://' + novelCoverPath;
      await downloadFile(
        sourceNovel.cover,
        novelCoverPath,
        getPlugin(pluginId)?.imageRequestInit,
      );
      db.runSync(
        'UPDATE Novel SET cover = ? WHERE id = ?',
        novelCoverUri,
        novelId,
      );
    }
    await insertChapters(novelId, sourceNovel.chapters);
  }
  return novelId;
};

export const getAllNovels = () => {
  return db.getAllAsync<NovelInfo>('SELECT * FROM Novel');
};

export const getNovelById = (novelId: number) => {
  return db.getFirstAsync<NovelInfo>(
    'SELECT * FROM Novel WHERE id = ?',
    novelId,
  );
};

export const getNovelByPath = (
  novelPath: string,
  pluginId: string,
): NovelInfo | null => {
  return db.getFirstSync<NovelInfo>(
    'SELECT * FROM Novel WHERE path = ? AND pluginId = ?',
    novelPath,
    pluginId,
  );
};

// if query is insert novel || add to library => add default category name for it
// else remove all it's categories

export const switchNovelToLibraryQuery = async (
  novelPath: string,
  pluginId: string,
): Promise<NovelInfo | undefined> => {
  const novel = getNovelByPath(novelPath, pluginId);
  if (novel) {
    await db.runAsync(
      'UPDATE Novel SET inLibrary = ? WHERE id = ?',
      Number(!novel.inLibrary),
      novel.id,
    );
    if (novel.inLibrary) {
      await db.runAsync(
        'DELETE FROM NovelCategory WHERE novelId = ?',
        novel.id,
      );
      showToast(getString('browseScreen.removeFromLibrary'));
    } else {
      await db.runAsync(
        'INSERT INTO NovelCategory (novelId, categoryId) VALUES (?, (SELECT DISTINCT id FROM Category WHERE sort = 1))',
        novel.id,
      );
      showToast(getString('browseScreen.addedToLibrary'));
    }
    if (novel.pluginId === 'local') {
      await db.runAsync(
        'INSERT INTO NovelCategory (novelId, categoryId) VALUES (?, 2)',
        novel.id,
      );
    }
    return { ...novel, inLibrary: !novel.inLibrary };
  } else {
    const sourceNovel = await fetchNovel(pluginId, novelPath);
    const novelId = await insertNovelAndChapters(pluginId, sourceNovel);
    if (novelId) {
      await db.runAsync('UPDATE Novel SET inLibrary = 1 WHERE id = ?', novelId);
      await db.runAsync(
        'INSERT INTO NovelCategory (novelId, categoryId) VALUES (?, (SELECT DISTINCT id FROM Category WHERE sort = 1))',
        novelId,
      );
      showToast(getString('browseScreen.addedToLibrary'));
    }
  }
};

// allow to delete local novels
export const removeNovelsFromLibrary = (novelIds: Array<number>) => {
  db.runSync(
    `UPDATE Novel SET inLibrary = 0 WHERE id IN (${novelIds.join(', ')})`,
  );
  db.runSync(
    `DELETE FROM NovelCategory WHERE novelId IN (${novelIds.join(', ')})`,
  );
  showToast(getString('browseScreen.removeFromLibrary'));
};

export const getCachedNovels = () => {
  return db.getAllAsync<NovelInfo>('SELECT * FROM Novel WHERE inLibrary = 0');
};

export const deleteCachedNovels = async () => {
  await db.runAsync('DELETE FROM Novel WHERE inLibrary = 0');
  showToast(getString('advancedSettingsScreen.cachedNovelsDeletedToast'));
};

const restoreFromBackupQuery =
  'INSERT OR REPLACE INTO Novel (path, name, pluginId, cover, summary, author, artist, status, genres, totalPages) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

export const restoreLibrary = async (novel: NovelInfo) => {
  const sourceNovel = await fetchNovel(novel.pluginId, novel.path);
  let novelId: number | undefined;

  await db.withExclusiveTransactionAsync(async tx => {
    const result = await tx.runAsync(
      restoreFromBackupQuery,
      sourceNovel.path,
      novel.name,
      novel.pluginId,
      novel.cover || '',
      novel.summary || '',
      novel.author || '',
      novel.artist || '',
      novel.status || '',
      novel.genres || '',
      sourceNovel.totalPages || 0,
    );
    novelId = result.lastInsertRowId;
  });

  if (novelId && novelId > 0) {
    await db.runAsync(
      'INSERT OR REPLACE INTO NovelCategory (novelId, categoryId) VALUES (?, (SELECT DISTINCT id FROM Category WHERE sort = 1))',
      novelId,
    );
    await db.runAsync('UPDATE Novel SET inLibrary = 1 WHERE id = ?', novelId);

    if (sourceNovel.chapters) {
      await insertChapters(novelId, sourceNovel.chapters);
    }
  }
};

export const updateNovelInfo = async (info: NovelInfo) => {
  await db.runAsync(
    'UPDATE Novel SET name = ?, cover = ?, path = ?, summary = ?, author = ?, artist = ?, genres = ?, status = ?, isLocal = ? WHERE id = ?',
    info.name,
    info.cover || '',
    info.path,
    info.summary || '',
    info.author || '',
    info.artist || '',
    info.genres || '',
    info.status || '',
    Number(info.isLocal),
    info.id,
  );
};

export const pickCustomNovelCover = async (novel: NovelInfo) => {
  const image = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
  if (image.assets && image.assets[0]) {
    const novelDir = NOVEL_STORAGE + '/' + novel.pluginId + '/' + novel.id;
    let novelCoverUri = 'file://' + novelDir + '/cover.png';
    if (!NativeFile.exists(novelDir)) {
      NativeFile.mkdir(novelDir);
    }
    NativeFile.copyFile(image.assets[0].uri, novelCoverUri);
    novelCoverUri += '?' + Date.now();
    await db.runAsync(
      'UPDATE Novel SET cover = ? WHERE id = ?',
      novelCoverUri,
      novel.id,
    );
    return novelCoverUri;
  }
};

export const updateNovelCategoryById = async (
  novelId: number,
  categoryIds: number[],
) => {
  for (const categoryId of categoryIds) {
    await db.runAsync(
      'INSERT INTO NovelCategory (novelId, categoryId) VALUES (?, ?)',
      novelId,
      categoryId,
    );
  }
};

export const updateNovelCategories = (
  novelIds: number[],
  categoryIds: number[],
): void => {
  db.runSync(
    `DELETE FROM NovelCategory WHERE novelId IN (${novelIds.join(
      ',',
    )}) AND categoryId != 2`,
  );
  // if no category is selected => set to the default category
  if (categoryIds.length) {
    for (const novelId of novelIds) {
      for (const categoryId of categoryIds) {
        db.runSync(
          `INSERT INTO NovelCategory (novelId, categoryId) VALUES (${novelId}, ${categoryId})`,
        );
      }
    }
  } else {
    for (const novelId of novelIds) {
      // hacky: insert local novel category -> failed -> ignored
      db.runSync(
        `INSERT OR IGNORE INTO NovelCategory (novelId, categoryId) 
         VALUES (
          ${novelId}, 
          IFNULL((SELECT categoryId FROM NovelCategory WHERE novelId = ${novelId}), (SELECT id FROM Category WHERE sort = 1))
        )`,
      );
    }
  }
};

const restoreObjectQuery = (table: string, obj: any) => {
  return `
  INSERT INTO ${table}
  (${Object.keys(obj).join(',')})
  VALUES (${Object.keys(obj)
    .map(() => '?')
    .join(',')})
  `;
};

export const _restoreNovelAndChapters = async (backupNovel: BackupNovel) => {
  const { chapters, ...novel } = backupNovel;
  await db.runAsync('DELETE FROM Novel WHERE id = ?', novel.id);
  await db.runAsync(
    restoreObjectQuery('Novel', novel),
    ...(Object.values(novel) as (string | number)[]),
  );
  if (chapters.length > 0) {
    for (const chapter of chapters) {
      await db.runAsync(
        restoreObjectQuery('Chapter', chapter),
        ...(Object.values(chapter) as (string | number)[]),
      );
    }
  }
};
