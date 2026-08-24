/**
 * The EPUB port (spec-arch-epub-port): a deep module exposing
 * `importNovel` / `exportNovel` with intent-only parameters, typed
 * progress phases, and errors-as-data (`Result<T, EpubError[]>`).
 *
 * Interface rules:
 * - No toasts and no UI strings inside src/services/epub/** — callers own
 *   user-facing surfacing (AC1 grep gate).
 * - Callers pass intent only; chapter queries, path assembly, storage
 *   layout, and metadata assembly live here (export) or stay behind the
 *   parse call (import).
 * - Native modules adapt internally; jest module fakes are the second
 *   adapter at this seam.
 *
 * Behavior is unchanged from the pre-refactor entry points — structure
 * moved (AC5 parity via the #1997 operation-count budgets).
 */

import dayjs from 'dayjs';
import {
  getNovelById,
  updateNovelCategoryById,
  updateNovelInfo,
} from '@database/queries/NovelQueries';
import { LOCAL_PLUGIN_ID } from '@plugins/pluginManager';
import { NOVEL_STORAGE } from '@utils/Storages';
import { dbManager } from '@database/db';
import { novelSchema, chapterSchema } from '@database/schema';
import {
  epub,
  type EpubExportChapter,
  type EpubExportMetadata,
} from '@modules/nitro-epub';
import type { ChapterInfo } from '@database/types';
import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { getNovelDownloadedChapters } from '@database/queries/ChapterQueries';

export type EpubError =
  | { kind: 'parse-failure'; message?: string }
  | { kind: 'file-not-found'; path: string }
  | { kind: 'zip-corrupt'; path: string }
  | { kind: 'image-move-partial'; moved: string[]; failed: string[] }
  | { kind: 'db-write-failure'; stage: 'novel' | 'chapter' };

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: EpubError[] };

export type ProgressPhase = 'copy' | 'extract' | 'parse' | 'db' | 'images';

export type Progress = {
  phase: ProgressPhase;
  current: number;
  total: number;
};

const decodePath = (path: string): string => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

const chapterNameFallback = (path: string): string =>
  path.split(/[/\\]/).pop() || 'unknown';

const sanitizeEpubFileName = (fileName: string) => {
  const withoutExtension = fileName.trim().replace(/\.epub$/i, '');
  return (
    withoutExtension
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .replace(/[. ]+$/g, '')
      .trim() || 'novel'
  );
};

// ---------------------------------------------------------------- import --

interface ParsedChapterFixtureShape {
  path: string;
  name?: string;
}

interface ParsedNovelShape {
  name?: string;
  cover?: string;
  author?: string;
  artist?: string;
  summary?: string;
  chapters?: ParsedChapterFixtureShape[];
  imagePaths: string[];
  cssPaths: string[];
}

export interface ImportArgs {
  uri: string;
  filename: string;
}

export interface ImportValue {
  novelId: number;
  name: string;
  chapterCount: number;
}

export const importNovel = async (
  file: ImportArgs,
  onProgress?: (p: Progress) => void,
): Promise<Result<ImportValue>> => {
  const errors: EpubError[] = [];
  const report = (phase: ProgressPhase, current = 0, total = 0) =>
    onProgress?.({ phase, current, total });

  const epubFilePath = `${NativeFile.ExternalCachesDirectoryPath}/novel.epub`;
  const epubDirPath = `${NativeFile.ExternalCachesDirectoryPath}/epub`;

  try {
    report('copy');
    if (!(await NativeFile.exists(file.uri))) {
      errors.push({ kind: 'file-not-found', path: file.uri });
      return { ok: false, errors };
    }

    if (await NativeFile.exists(epubDirPath)) {
      await NativeFile.unlink(epubDirPath);
    }
    await NativeFile.mkdir(epubDirPath);
    await NativeFile.copyFile(file.uri, epubFilePath);

    report('extract');
    try {
      await NativeZipArchive.unzip(epubFilePath, epubDirPath);
    } catch {
      errors.push({ kind: 'zip-corrupt', path: epubFilePath });
      return { ok: false, errors };
    }

    report('parse', 0, 1);
    let novel: ParsedNovelShape;
    try {
      novel = (await epub.parseNovelAndChapters(
        epubDirPath,
      )) as unknown as ParsedNovelShape;
    } catch (error) {
      errors.push({
        kind: 'parse-failure',
        message: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, errors };
    }

    if (!novel.name) {
      novel.name = file.filename.replace('.epub', '') || 'Untitled';
    }

    report('db', 0, Math.max(1, novel.chapters?.length ?? 0));
    const insertId = await insertLocalNovel(novel, errors);
    if (insertId === null) {
      return { ok: false, errors };
    }

    const now = dayjs().toISOString();
    const totalChapters = novel.chapters?.length ?? 0;

    for (let i = 0; i < totalChapters; i++) {
      const chapter = novel.chapters![i];
      if (!chapter.name) {
        chapter.name = chapterNameFallback(chapter.path);
      }
      const failed = await insertLocalChapter(
        insertId,
        i,
        chapter.name,
        chapter.path,
        now,
        errors,
      );
      if (!failed) {
        return { ok: false, errors };
      }
      report('db', i + 1, totalChapters);
    }

    const novelDir = `${NOVEL_STORAGE}/local/${insertId}`;

    report('images', 0, novel.imagePaths.length + novel.cssPaths.length);
    const moved: string[] = [];
    const failedMoves: string[] = [];

    for (const filePath of [...novel.imagePaths, ...novel.cssPaths]) {
      const decodedPath = decodePath(filePath);
      if (await NativeFile.exists(decodedPath)) {
        try {
          await NativeFile.moveFile(
            decodedPath,
            `${novelDir}/${filePath.split(/[/\\]/).pop()}`,
          );
          moved.push(filePath);
        } catch {
          failedMoves.push(filePath);
        }
      } else {
        failedMoves.push(filePath);
      }
    }

    if (failedMoves.length > 0) {
      errors.push({
        kind: 'image-move-partial',
        moved,
        failed: failedMoves,
      });
      return { ok: false, errors };
    }

    report('images', moved.length, moved.length);

    return {
      ok: true,
      value: {
        novelId: insertId,
        name: novel.name,
        chapterCount: totalChapters,
      },
    };
  } catch (error) {
    // Anything unclassified still surfaces as data, never swallowed.
    errors.push({
      kind: 'parse-failure',
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, errors };
  }
};

const insertLocalNovel = async (
  novel: ParsedNovelShape,
  errors: EpubError[],
): Promise<number | null> => {
  try {
    const { insertId } = await dbManager.write(async tx => {
      return tx
        .insert(novelSchema)
        .values({
          name: novel.name!,
          path: '',
          pluginId: 'local',
          inLibrary: true,
          isLocal: true,
        })
        .run();
    });

    if (insertId !== undefined && insertId >= 0) {
      await updateNovelCategoryById(insertId, [2]);
      const novelDir = `${NOVEL_STORAGE}/local/${insertId}`;
      await NativeFile.mkdir(novelDir);
      const newCoverPath = `file://${novelDir}/${novel.cover
        ?.split(/[/\\]/)
        .pop()}`;

      if (novel.cover) {
        const decodedPath = decodePath(novel.cover);
        if (await NativeFile.exists(decodedPath)) {
          await NativeFile.moveFile(decodedPath, newCoverPath);
        }
      }
      await updateNovelInfo({
        id: insertId,
        pluginId: LOCAL_PLUGIN_ID,
        author: novel.author || '',
        artist: novel.artist || '',
        summary: novel.summary || '',
        path: novelDir,
        cover: newCoverPath,
        name: novel.name!,
        inLibrary: true,
        isLocal: true,
        totalPages: 0,
      });
      return insertId;
    }
    errors.push({ kind: 'db-write-failure', stage: 'novel' });
    return null;
  } catch (error) {
    errors.push({
      kind: 'db-write-failure',
      stage: 'novel',
    });
    void error;
    return null;
  }
};

const insertLocalChapter = async (
  novelId: number,
  fakeId: number,
  name: string,
  path: string,
  releaseTime: string,
  errors: EpubError[],
): Promise<boolean> => {
  try {
    const { insertId } = await dbManager.write(async tx => {
      return tx
        .insert(chapterSchema)
        .values({
          novelId,
          name,
          path: `${NOVEL_STORAGE}/local/${novelId}/${fakeId}`,
          releaseTime,
          position: fakeId,
          isDownloaded: true,
        })
        .run();
    });

    if (insertId !== undefined && insertId >= 0) {
      const chapterText = await NativeFile.readFile(decodePath(path));
      if (!chapterText) {
        return true;
      }
      const novelDir = `${NOVEL_STORAGE}/local/${novelId}`;
      const rewritten = chapterText.replace(
        /[=](?<= href=| src=)(["'])([^]*?)\1/g,
        (_, __, $2: string) =>
          `="file://${novelDir}/${$2.split(/[/\\]/).pop()}"`,
      );
      await NativeFile.mkdir(`${novelDir}/${insertId}`);
      await NativeFile.writeFile(
        `${novelDir}/${insertId}/index.html`,
        rewritten,
      );
      return true;
    }
    errors.push({ kind: 'db-write-failure', stage: 'chapter' });
    return false;
  } catch {
    errors.push({ kind: 'db-write-failure', stage: 'chapter' });
    return false;
  }
};

// ---------------------------------------------------------------- export --

export interface ExportOptions {
  destinationUri: string;
  filenameOverride?: string;
  applyReaderTheme: boolean;
  includeCustomJs: boolean;
}

export interface ExportValue {
  uri: string;
}

/**
 * Assemble-and-export lives INSIDE the port: callers pass intent only.
 */
export const exportNovel = async (
  novelId: number,
  options: ExportOptions,
  onProgress?: (p: Progress) => void,
): Promise<Result<ExportValue>> => {
  const report = (phase: ProgressPhase, current = 0, total = 0) =>
    onProgress?.({ phase, current, total });

  try {
    report('db', 0, 1);
    let chapters: ChapterInfo[];
    try {
      chapters = await getNovelDownloadedChapters(novelId);
    } catch {
      return {
        ok: false,
        errors: [{ kind: 'db-write-failure', stage: 'chapter' }],
      };
    }

    if (chapters.length === 0) {
      return {
        ok: false,
        errors: [{ kind: 'parse-failure', message: 'no downloaded chapters' }],
      };
    }

    report('parse', 0, chapters.length);
    // Assembly ownership moved inside: the port queries the novel row for
    // metadata parity with the old caller-assembled export.
    const novel = getNovelById(novelId);
    const pluginId = novel?.pluginId ?? 'local';
    const epubChapters: EpubExportChapter[] = chapters.map(chapter => ({
      title: chapter.name ?? '',
      htmlPath: `${NOVEL_STORAGE}/${pluginId}/${chapter.novelId}/${chapter.id}/index.html`,
      novelId: String(chapter.novelId),
      chapterId: String(chapter.id),
    }));

    const tempEpubPath = `${
      NativeFile.ExternalCachesDirectoryPath
    }/epub-export-${Date.now()}.epub`;

    report('copy', 0, chapters.length);
    const result = await epub.exportEpub(
      buildExportMetadata(novel, novelId, pluginId),
      epubChapters,
      tempEpubPath,
      async (completedChapters: number, totalChapters: number) => {
        report('parse', completedChapters, Math.max(1, totalChapters));
      },
    );

    report('copy', 1, 1);
    const epubFileName = `${sanitizeEpubFileName(
      options.filenameOverride ?? `novel-${novelId}`,
    )}.epub`;
    const copyResult = await NativeFile.copyFileToDirectory(
      result.outputPath,
      options.destinationUri,
      epubFileName,
      'application/epub+zip',
      true,
    );
    if (copyResult.size <= 0) {
      return {
        ok: false,
        errors: [{ kind: 'parse-failure', message: 'Exported EPUB is empty' }],
      };
    }

    report('copy', 1, 1);

    try {
      if (await NativeFile.exists(tempEpubPath)) {
        await NativeFile.unlink(tempEpubPath);
      }
    } catch {
      // Cleanup must not replace the original result.
    }

    return {
      ok: true,
      value: { uri: `${options.destinationUri}/${epubFileName}` },
    };
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          kind: 'parse-failure',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
};

const buildExportMetadata = (
  novel:
    | {
        name?: string | null;
        cover?: string | null;
        author?: string | null;
        summary?: string | null;
      }
    | undefined,
  novelId: number,
  pluginId: string,
): EpubExportMetadata => ({
  title: novel?.name ?? `novel-${novelId}`,
  language: 'en',
  coverPath: novel?.cover ?? '',
  description: novel?.summary ?? '',
  author: novel?.author ?? '',
  bookId: `urn:lnreader:${pluginId}:${novelId}`,
  stylesheet: '',
  javascript: '',
});
