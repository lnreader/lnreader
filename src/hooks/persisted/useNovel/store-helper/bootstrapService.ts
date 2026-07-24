import { ChapterFilterKey, ChapterOrderKey } from '@database/constants';
import {
  getChapterCount as defaultGetChapterCount,
  getChapterCountSync as defaultGetChapterCountSync,
  getCustomPages as defaultGetCustomPages,
  getFirstUnreadChapter as defaultGetFirstUnreadChapter,
  getNovelChaptersSync as defaultGetNovelChaptersSync,
  getPageChapters as defaultGetPageChapters,
  getPageChaptersBatched as defaultGetPageChaptersBatched,
  insertChapters as defaultInsertChapters,
  getNovelScanlatorsSync as defaultGetNovelScanlatorsSync,
} from '@database/queries/ChapterQueries';
import {
  getNovelById as defaultGetNovelById,
  getNovelByPath as defaultGetNovelByPath,
  insertNovelAndChapters as defaultInsertNovelAndChapters,
} from '@database/queries/NovelQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import {
  fetchNovel as defaultFetchNovel,
  fetchPage as defaultFetchPage,
} from '@services/plugin/fetch';
import { getString as defaultGetString } from '@i18n/translations';
import { BatchInfo } from '../types';

export interface ChapterLoadResult {
  chapters: ChapterInfo[];
  batchInformation: BatchInfo;
  firstUnreadChapter: ChapterInfo | undefined;
}

export const CHAPTER_BATCH_SIZE = 1000;

export interface BootstrapSuccessResult extends ChapterLoadResult {
  ok: true;
  novel: NovelInfo;
  pages: string[];
  pageIndex: number;
  scanlators: string[];
}

export interface BootstrapFailureResult {
  ok: false;
  reason: 'missing-novel' | 'missing-chapters' | 'error';
  error?: unknown;
}

export type BootstrapResult = BootstrapSuccessResult | BootstrapFailureResult;

const inflightBootstraps = new Map<string, Promise<BootstrapResult>>();

const getBootstrapKey = ({
  pluginId,
  novelPath,
  pageIndex,
  settingsSort,
  settingsFilter,
  excludedScanlators,
}: {
  pluginId: string;
  novelPath: string;
  pageIndex: number;
  settingsSort: ChapterOrderKey;
  settingsFilter: ChapterFilterKey[];
  excludedScanlators?: string[];
}) =>
  JSON.stringify([
    pluginId,
    novelPath,
    pageIndex,
    settingsSort,
    settingsFilter,
    excludedScanlators ?? [],
  ]);

const getLastBatchIndex = (chapterCount: number) =>
  Math.max(0, Math.ceil(chapterCount / CHAPTER_BATCH_SIZE) - 1);

const clampPageIndex = (pageIndex: number, pages: string[]) =>
  Math.min(Math.max(pageIndex, 0), Math.max(pages.length - 1, 0));

const defaultBootstrapServiceDependencies = {
  getCustomPages: defaultGetCustomPages,
  getNovelByPath: defaultGetNovelByPath,
  getNovelById: defaultGetNovelById,
  fetchNovel: defaultFetchNovel,
  insertNovelAndChapters: defaultInsertNovelAndChapters,
  getChapterCount: defaultGetChapterCount,
  getChapterCountSync: defaultGetChapterCountSync,
  getPageChaptersBatched: defaultGetPageChaptersBatched,
  getNovelChaptersSync: defaultGetNovelChaptersSync,
  fetchPage: defaultFetchPage,
  insertChapters: defaultInsertChapters,
  getPageChapters: defaultGetPageChapters,
  getFirstUnreadChapter: defaultGetFirstUnreadChapter,
  getNovelScanlatorsSync: defaultGetNovelScanlatorsSync,
  getString: defaultGetString,
} as const;
export type BootstrapServiceDependencies =
  typeof defaultBootstrapServiceDependencies;

export const createBootstrapService = (
  dependencies: Partial<BootstrapServiceDependencies> = {},
) => {
  const deps: BootstrapServiceDependencies = {
    ...defaultBootstrapServiceDependencies,
    ...dependencies,
  };

  const calculatePages = (tmpNovel: NovelInfo): string[] => {
    let tmpPages: string[];
    if ((tmpNovel.totalPages ?? 0) > 0) {
      tmpPages = Array(tmpNovel.totalPages)
        .fill(0)
        .map((_, idx) => String(idx + 1));
    } else {
      tmpPages = deps
        .getCustomPages(tmpNovel.id)
        .map(c => c.page)
        .filter((page): page is string => page !== null);
    }

    return tmpPages.length > 1 ? tmpPages : ['1'];
  };

  const resolveNovel = async (
    novelPath: string,
    pluginId: string,
  ): Promise<NovelInfo | undefined> => {
    let tmpNovel = deps.getNovelByPath(novelPath, pluginId);
    if (!tmpNovel) {
      const sourceNovel = await deps
        .fetchNovel(pluginId, novelPath)
        .catch(() => {
          throw new Error(deps.getString('updatesScreen.unableToGetNovel'));
        });
      await deps.insertNovelAndChapters(pluginId, sourceNovel);
      tmpNovel = deps.getNovelByPath(novelPath, pluginId);

      if (!tmpNovel) {
        return;
      }
    }

    return tmpNovel;
  };

  const getChaptersForPage = async ({
    novel,
    novelPath,
    pluginId,
    pages,
    pageIndex,
    settingsSort,
    settingsFilter,
    excludedScanlators,
  }: {
    novel: NovelInfo;
    novelPath: string;
    pluginId: string;
    pages: string[];
    pageIndex: number;
    settingsSort: ChapterOrderKey;
    settingsFilter: ChapterFilterKey[];
    excludedScanlators?: string[];
  }): Promise<ChapterLoadResult> => {
    const page = pages[pageIndex] ?? pages[0] ?? '1';
    let newChapters: ChapterInfo[] = [];

    let chapterCount = await deps.getChapterCount(
      novel.id,
      page,
      settingsFilter,
      excludedScanlators,
    );
    if (chapterCount) {
      newChapters =
        (await deps.getPageChaptersBatched(
          novel.id,
          settingsSort,
          settingsFilter,
          page,
          0,
          excludedScanlators,
        )) || [];
    } else if (settingsFilter.length === 0) {
      const sourcePage = await deps.fetchPage(pluginId, novelPath, page);
      const sourceChapters = sourcePage.chapters.map(ch => {
        return {
          ...ch,
          page,
        };
      });
      await deps.insertChapters(novel.id, sourceChapters);
      newChapters = await deps.getPageChapters(
        novel.id,
        settingsSort,
        settingsFilter,
        page,
        undefined,
        undefined,
        excludedScanlators,
      );
      chapterCount = await deps.getChapterCount(
        novel.id,
        page,
        settingsFilter,
        excludedScanlators,
      );
    }

    const batchInformation: BatchInfo = {
      batch: 0,
      total: getLastBatchIndex(chapterCount),
      totalChapters: chapterCount,
    };
    const unread = deps.getFirstUnreadChapter(
      novel.id,
      settingsFilter,
      page,
      excludedScanlators,
    );
    return {
      chapters: newChapters,
      batchInformation,
      firstUnreadChapter: unread ?? undefined,
    };
  };

  const getNextChapterBatch = async ({
    novel,
    pages,
    pageIndex,
    settingsSort,
    settingsFilter,
    batchInformation,
    excludedScanlators,
  }: {
    novel: NovelInfo | undefined;
    pages: string[];
    pageIndex: number;
    settingsSort: ChapterOrderKey;
    settingsFilter: ChapterFilterKey[];
    batchInformation: BatchInfo;
    excludedScanlators?: string[];
  }) => {
    const page = pages[pageIndex];
    const nextBatch = batchInformation.batch + 1;
    if (!novel || !page || nextBatch > batchInformation.total) {
      return;
    }

    const newChapters =
      (await deps.getPageChaptersBatched(
        novel.id,
        settingsSort,
        settingsFilter,
        page,
        nextBatch,
        excludedScanlators,
      )) || [];

    return {
      batch: nextBatch,
      chapters: newChapters,
    };
  };

  const loadUpToBatch = async ({
    targetBatch,
    novel,
    pages,
    pageIndex,
    settingsSort,
    settingsFilter,
    batchInformation,
    onBatchLoaded,
    excludedScanlators,
  }: {
    targetBatch: number;
    novel: NovelInfo | undefined;
    pages: string[];
    pageIndex: number;
    settingsSort: ChapterOrderKey;
    settingsFilter: ChapterFilterKey[];
    batchInformation: BatchInfo;
    onBatchLoaded: (batch: number, chapters: ChapterInfo[]) => void;
    excludedScanlators?: string[];
  }) => {
    const page = pages[pageIndex] ?? '1';
    if (!novel || !page || targetBatch <= batchInformation.batch) {
      return;
    }

    for (
      let batch = batchInformation.batch + 1;
      batch <= targetBatch;
      batch++
    ) {
      if (batch > batchInformation.total) break;

      const newChapters =
        (await deps.getPageChaptersBatched(
          novel.id,
          settingsSort,
          settingsFilter,
          page,
          batch,
          excludedScanlators,
        )) || [];

      onBatchLoaded(batch, newChapters);
    }
  };

  const bootstrapNovelAsync = async ({
    novel,
    novelPath,
    pluginId,
    pageIndex,
    settingsSort,
    settingsFilter,
    excludedScanlators,
  }: {
    novel: NovelInfo | undefined;
    novelPath: string;
    pluginId: string;
    pageIndex: number;
    settingsSort: ChapterOrderKey;
    settingsFilter: ChapterFilterKey[];
    excludedScanlators?: string[];
  }): Promise<BootstrapResult> => {
    const key = getBootstrapKey({
      pluginId,
      novelPath,
      pageIndex,
      settingsSort,
      settingsFilter,
      excludedScanlators,
    });
    const existing = inflightBootstraps.get(key);
    if (existing) {
      return existing;
    }

    const bootstrapPromise = (async () => {
      try {
        const resolvedNovel =
          novel ?? (await resolveNovel(novelPath, pluginId));
        if (!resolvedNovel) {
          return {
            ok: false,
            reason: 'missing-novel',
          } satisfies BootstrapFailureResult;
        }

        const pages = calculatePages(resolvedNovel);
        const resolvedPageIndex = clampPageIndex(pageIndex, pages);
        const chapterState = await getChaptersForPage({
          novel: resolvedNovel,
          novelPath,
          pluginId,
          pages,
          pageIndex: resolvedPageIndex,
          settingsSort,
          settingsFilter,
          excludedScanlators,
        });

        const scanlators = deps.getNovelScanlatorsSync(resolvedNovel.id);

        return {
          ok: true,
          novel: resolvedNovel,
          pages,
          pageIndex: resolvedPageIndex,
          scanlators,
          ...chapterState,
        } satisfies BootstrapSuccessResult;
      } catch (error) {
        return {
          ok: false,
          reason: 'error',
          error,
        } satisfies BootstrapFailureResult;
      } finally {
        inflightBootstraps.delete(key);
      }
    })();

    inflightBootstraps.set(key, bootstrapPromise);
    return bootstrapPromise;
  };
  const bootstrapNovelSync = ({
    novel: _novel,
    novelPath,
    pluginId,
    pageIndex,
    settingsSort,
    settingsFilter,
    excludedScanlators,
  }: {
    novel: NovelInfo | undefined;
    novelPath: string;
    pluginId: string;
    pageIndex: number;
    settingsSort: ChapterOrderKey;
    settingsFilter: ChapterFilterKey[];
    excludedScanlators?: string[];
  }): BootstrapResult => {
    try {
      const novel = !_novel?.id
        ? deps.getNovelByPath(novelPath, pluginId)
        : deps.getNovelById(_novel.id);
      if (!novel) {
        return {
          ok: false,
          reason: 'missing-novel',
        } satisfies BootstrapFailureResult;
      }

      const pages = calculatePages(novel);
      const resolvedPageIndex = clampPageIndex(pageIndex, pages);
      const page = pages[resolvedPageIndex] ?? '1';
      const chapterCount =
        settingsFilter.length === 0 &&
        pages.length === 1 &&
        (!excludedScanlators || excludedScanlators.length === 0)
          ? novel.totalChapters ?? 0
          : deps.getChapterCountSync(
              novel.id,
              page,
              settingsFilter,
              excludedScanlators,
            );
      if (chapterCount === 0 && settingsFilter.length === 0) {
        return {
          ok: false,
          reason: 'missing-chapters',
        } satisfies BootstrapFailureResult;
      }

      const newChapters = deps.getNovelChaptersSync(
        novel.id,
        settingsSort,
        settingsFilter,
        page,
        CHAPTER_BATCH_SIZE,
        excludedScanlators,
      );

      const batchInformation: BatchInfo = {
        batch: 0,
        total: getLastBatchIndex(chapterCount),
        totalChapters: chapterCount,
      };
      const unread = deps.getFirstUnreadChapter(
        novel.id,
        settingsFilter,
        page,
        excludedScanlators,
      );
      const scanlators = deps.getNovelScanlatorsSync(novel.id);

      return {
        ok: true,
        novel,
        pages,
        pageIndex: resolvedPageIndex,
        chapters: newChapters,
        batchInformation,
        firstUnreadChapter: unread ?? undefined,
        scanlators,
      } satisfies BootstrapSuccessResult;
    } catch (error) {
      return {
        ok: false,
        reason: 'error',
        error,
      } satisfies BootstrapFailureResult;
    }
  };

  return {
    getChaptersForPage,
    getNextChapterBatch,
    loadUpToBatch,
    bootstrapNovelAsync,
    bootstrapNovelSync,
  };
};

export const bootstrapService = createBootstrapService();
