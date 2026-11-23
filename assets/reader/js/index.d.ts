import { ChapterInfo, NovelInfo } from '@database/types';
import {
  ChapterGeneralSettings,
  ChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import { State } from './van';

export interface Reader {
  // element
  chapterElement: HTMLElement;
  viewport: HTMLMetaElement;
  selection: Selection;

  // state
  hidden: State<boolean>;
  generalSettings: State<ChapterGeneralSettings>;
  readerSettings: State<ChapterReaderSettings>;
  batteryLevel: State<number>;
  /** Bumped whenever the app pushes newly resolved adjacent chapters. */
  adjacentVersion: State<number>;
  /** Bumped whenever a new chapter is swapped into the loaded page. */
  chapterVersion: State<number>;

  novel: NovelInfo;
  chapter: ChapterInfo;
  nextChapter?: ChapterInfo;
  prevChapter?: ChapterInfo;
  autoSaveInterval: number;
  rawHTML: string;
  strings: {
    finished: string;
    nextChapter: string;
    noNextChapter: string;
    removeText: string;
    replaceText: string;
  };

  setAdjacentChapters: (adjacent: {
    nextChapter?: ChapterInfo;
    prevChapter?: ChapterInfo;
    strings?: Partial<Reader['strings']>;
  }) => void;

  //layout props
  paddingTop: number;
  layoutHeight: number;
  layoutWidth: number;
  chapterHeight: number;
  chapterWidth: number;

  /**
   * Shows another chapter in the already loaded page. Posts
   * `{ type: 'chapter-shown', chapterId }` once it is laid out and its reading
   * position restored, or `{ type: 'chapter-swap-failed', chapterId }`.
   * Dispatches `ln:chapter-change` on `document` for scripts that keep
   * per-chapter state.
   */
  setChapter: (payload: {
    chapter: ChapterInfo;
    novel: NovelInfo;
    html: string;
    strings: Omit<Reader['strings'], 'nextChapter'>;
    nextChapterScreenVisible: boolean;
  }) => void;

  post: (obj: Record<string, any>) => void;
  refresh: () => void;
}

interface PageReader {
  page: State<number>;
  totalPages: State<number>;
  movePage: (page: number) => void;
  resetForChapter: (
    chapterName: string,
    nextChapterScreenVisible: boolean,
  ) => void;
}

interface TTS {
  started: boolean;
  reading: boolean;
  start: (element?: HTMLElement) => void;
  resume: () => void;
  stop: () => void;
  /** Clears the element cursor and highlight without stopping playback. */
  reset: () => void;
  pause: () => void;
  readable: (element?: HTMLElement) => void;
}

declare global {
  const reader: Reader;
  const tts: TTS;
  const pageReader: PageReader;
}
