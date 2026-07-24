import dayjs from 'dayjs';
import {
  updateNovelCategoryById,
  updateNovelInfo,
} from '@database/queries/NovelQueries';
import { LOCAL_PLUGIN_ID } from '@plugins/pluginManager';
import { getString } from '@i18n/translations';
import { NOVEL_STORAGE } from '@utils/Storages';
import { dbManager } from '@database/db';
import { novelSchema, chapterSchema } from '@database/schema';
import type {
  BackgroundTaskMetadata,
  EpubImportFile,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { epub } from '@modules/nitro-epub';
import { showToast } from '@utils/showToast';

const decodePath = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

const insertLocalNovel = async (
  name: string,
  path: string,
  cover?: string,
  author?: string,
  artist?: string,
  summary?: string,
) => {
  const { insertId } = await dbManager.write(async tx => {
    return tx
      .insert(novelSchema)
      .values({ name, path, pluginId: 'local', inLibrary: true, isLocal: true })
      .run();
  });

  if (insertId !== undefined && insertId >= 0) {
    await updateNovelCategoryById(insertId, [2]);
    const novelDir = NOVEL_STORAGE + '/local/' + insertId;
    await NativeFile.mkdir(novelDir);
    const newCoverPath = `file://${novelDir}/${cover?.split(/[/\\]/).pop()}`;

    if (cover) {
      const decodedPath = decodePath(cover);
      if (await NativeFile.exists(decodedPath)) {
        await NativeFile.moveFile(decodedPath, newCoverPath);
      }
    }
    await updateNovelInfo({
      id: insertId,
      pluginId: LOCAL_PLUGIN_ID,
      author: author,
      artist: artist,
      summary: summary,
      path: NOVEL_STORAGE + '/local/' + insertId,
      cover: newCoverPath,
      name: name,
      inLibrary: true,
      isLocal: true,
      totalPages: 0,
    });
    return insertId;
  }
  throw new Error(getString('advancedSettingsScreen.novelInsertFailed'));
};

const insertLocalChapter = async (
  novelId: number,
  fakeId: number,
  name: string,
  path: string,
  releaseTime: string,
) => {
  const { insertId } = await dbManager.write(async tx => {
    return tx
      .insert(chapterSchema)
      .values({
        novelId,
        name,
        path: NOVEL_STORAGE + '/local/' + novelId + '/' + fakeId,
        releaseTime,
        position: fakeId,
        isDownloaded: true,
      })
      .run();
  });

  if (insertId !== undefined && insertId >= 0) {
    let chapterText: string = '';
    chapterText = await NativeFile.readFile(decodePath(path));
    if (!chapterText) {
      return [];
    }
    const novelDir = `${NOVEL_STORAGE}/local/${novelId}`;
    chapterText = chapterText.replace(
      /[=](?<= href=| src=)(["'])([^]*?)\1/g,
      (_, __, $2: string) => {
        return `="file://${novelDir}/${$2.split(/[/\\]/).pop()}"`;
      },
    );
    await NativeFile.mkdir(novelDir + '/' + insertId);
    await NativeFile.writeFile(
      `${novelDir}/${insertId}/index.html`,
      chapterText,
    );
    return;
  }
  throw new Error(getString('advancedSettingsScreen.chapterInsertFailed'));
};

export const importEpub = async (
  { uri, filename }: EpubImportFile,
  setMeta: TaskProgressUpdater,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0,
  }));

  const epubFilePath = NativeFile.ExternalCachesDirectoryPath + '/novel.epub';
  const epubDirPath = NativeFile.ExternalCachesDirectoryPath + '/epub';

  try {
    if (await NativeFile.exists(epubDirPath)) {
      await NativeFile.unlink(epubDirPath);
    }
    await NativeFile.mkdir(epubDirPath);
    await NativeFile.copyFile(uri, epubFilePath);
    await NativeZipArchive.unzip(epubFilePath, epubDirPath);

    const novel = await epub.parseNovelAndChapters(epubDirPath);
    if (!novel.name) {
      novel.name = filename.replace('.epub', '') || 'Untitled';
    }
    const novelId = await insertLocalNovel(
      novel.name,
      epubDirPath + novel.name, // temporary
      novel.cover || '',
      novel.author || '',
      novel.artist || '',
      novel.summary || '',
    );
    const now = dayjs().toISOString();
    if (novel.chapters) {
      for (let i = 0; i < novel.chapters?.length; i++) {
        const chapter = novel.chapters[i];
        if (!chapter.name) {
          chapter.name = chapter.path.split(/[/\\]/).pop() || 'unknown';
        }

        setMeta(meta => ({
          ...meta,
          progressText: chapter.name,
        }));

        await insertLocalChapter(novelId, i, chapter.name, chapter.path, now);

        setMeta(meta => ({
          ...meta,
          progress: i / novel.chapters.length,
        }));
      }
    }
    const novelDir = NOVEL_STORAGE + '/local/' + novelId;

    setMeta(meta => ({
      ...meta,
      progressText: getString('advancedSettingsScreen.importStaticFiles'),
    }));

    for (const filePath of novel.imagePaths) {
      const decodedPath = decodePath(filePath);

      if (await NativeFile.exists(decodedPath)) {
        await NativeFile.moveFile(
          decodedPath,
          novelDir + '/' + filePath.split(/[/\\]/).pop(),
        );
      }
    }

    for (const filePath of novel.cssPaths) {
      const decodedPath = decodePath(filePath);
      if (await NativeFile.exists(decodedPath)) {
        await NativeFile.moveFile(
          decodedPath,
          novelDir + '/' + filePath.split(/[/\\]/).pop(),
        );
      }
    }
  } catch (error) {
    showToast(
      getString('advancedSettingsScreen.importFailed'),
      (error as Error).message,
    );
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));
};

export const importEpubBatch = async (
  { files }: { files: EpubImportFile[] },
  setMeta: TaskProgressUpdater,
) => {
  if (!files.length) return;

  const failures: string[] = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    let fileMeta: BackgroundTaskMetadata = {
      name: file.filename,
      isRunning: true,
      progress: 0,
      progressText: undefined,
    };
    let progressError: unknown;
    const updateFileProgress: TaskProgressUpdater = transformer => {
      fileMeta = transformer(fileMeta);
      try {
        setMeta(meta => ({
          ...meta,
          isRunning: true,
          progress: (index + (fileMeta.progress ?? 0)) / files.length,
          progressText: `${index + 1}/${files.length} · ${file.filename}${
            fileMeta.progressText ? ` · ${fileMeta.progressText}` : ''
          }`,
        }));
      } catch (error) {
        progressError = error;
        throw error;
      }
    };

    try {
      await importEpub(file, updateFileProgress);
    } catch (error) {
      if (error === progressError) throw error;

      failures.push(
        `${file.filename}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));

  if (failures.length) {
    throw new Error(
      `${failures.length} of ${
        files.length
      } EPUB imports failed: ${failures.join('; ')}`,
    );
  }
};
