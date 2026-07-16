import { StoreApi } from 'zustand/vanilla';
import { ChapterInfo, NovelInfo } from '@database/types';
import { ChapterActionsDependencies } from './chapterActions';
import { createBootstrapService } from '../store-helper/bootstrapService';
import { BatchInfo, NovelSettings } from '../types';

type ChapterTextValue = string | Promise<string>;

export interface ChapterTextCacheApi {
  read: (chapterId: number) => ChapterTextValue | undefined;
  write: (chapterId: number, value: ChapterTextValue) => void;
  remove: (chapterId: number) => void;
  clear: () => void;
}
export interface ChapterSliceState {
  chapters: ChapterInfo[];
  firstUnreadChapter: ChapterInfo | undefined;
  batchInformation: BatchInfo;
  chapterTextCache: Record<number, ChapterTextValue>;
  scanlators: string[];
}

export interface NovelStoreData extends ChapterSliceState {
  loading: boolean;
  fetching: boolean;

  pluginId: string;
  novelPath: string;
  novel: NovelInfo | undefined;

  pageIndex: number;
  pages: string[];

  novelSettings: NovelSettings;
  lastRead: ChapterInfo | undefined;
}

export interface NovelStoreChapterActions {
  chapterTextCache: ChapterTextCacheApi;
  getNextChapterBatch: () => Promise<void>;
  loadUpToBatch: (targetBatch: number) => Promise<void>;
  updateChapter: (index: number, update: Partial<ChapterInfo>) => void;
  setChapters: (chs: ChapterInfo[]) => void;
  extendChapters: (chs: ChapterInfo[]) => void;
  bookmarkChapters: (chapters: ChapterInfo[]) => void;
  markPreviouschaptersRead: (chapterId: number) => void;
  markChapterRead: (chapterId: number) => void;
  markChaptersRead: (chapters: ChapterInfo[]) => void;
  markPreviousChaptersUnread: (chapterId: number) => void;
  markChaptersUnread: (chapters: ChapterInfo[]) => void;
  updateChapterProgress: (chapterId: number, progress: number) => void;
  deleteChapter: (chapter: ChapterInfo) => void;
  deleteChapters: (chapters: ChapterInfo[]) => void;
  refreshChapters: () => void;
}

export interface NovelStoreNovelActions {
  bootstrapNovel: () => Promise<boolean>;
  bootstrapNovelSync: () => boolean;
  getChapters: () => Promise<void>;
  refreshNovel: () => Promise<void>;

  setNovel: (novel: NovelInfo | undefined) => void;
  setPages: (pages: string[]) => void;
  setPageIndex: (index: number) => void;
  openPage: (index: number) => Promise<void>;
  setNovelSettings: (settings: NovelSettings) => void;
  setLastRead: (chapter: ChapterInfo) => void;
  followNovel: () => Promise<void>;
}

export type NovelStoreActions = NovelStoreNovelActions &
  NovelStoreChapterActions;

export interface NovelStoreState extends NovelStoreData {
  actions: NovelStoreActions;
}

export type NovelStoreApi = StoreApi<NovelStoreState>;

export interface NovelStoreDependencies {
  bootstrapService: ReturnType<typeof createBootstrapService>;
  chapterActionsDependencies: ChapterActionsDependencies;
  transformChapters: (chs: ChapterInfo[]) => ChapterInfo[];
  persistPageIndex?: (value: number) => void;
  persistNovelSettings?: (value: NovelSettings) => void;
  persistLastRead?: (value: ChapterInfo) => void;
  switchNovelToLibrary?: (novelPath: string, pluginId: string) => Promise<void>;
}

export type SetState = {
  (
    partial:
      | NovelStoreState
      | Partial<NovelStoreState>
      | ((
          state: NovelStoreState,
        ) => NovelStoreState | Partial<NovelStoreState>),
    replace?: false,
  ): void;
  (
    state: NovelStoreState | ((state: NovelStoreState) => NovelStoreState),
    replace: true,
  ): void;
};

export type GetState = () => NovelStoreState;
