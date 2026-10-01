import type { ReaderPreferences } from '../../src/screens/reader/engine/preferences';
import type {
  ReaderLocation,
  ReaderOpenMessage,
} from '../../src/screens/reader/engine/protocol';
import type { Book } from './book';
import type { Bridge } from './bridge';
import type { ChapterContent } from './content';
import type { createImageViewer } from './images';
import type { createSearch } from './search';
import type { UserSnippets } from './snippets';
import type { createSpeech } from './speech';
import type { FoliatePaginator } from './types';

export interface Location {
  index: number;
  fraction: number;
  range?: Range;
  page?: number;
  pages?: number;
}

export interface ReaderState {
  readonly root: HTMLElement;
  readonly status: HTMLElement;
  readonly bridge: Bridge;
  config?: ReaderOpenMessage;
  prefs?: ReaderPreferences;
  book?: Book;
  paginator?: FoliatePaginator;
  snippets?: UserSnippets;
  location?: Location;
  battery: number;
  readonly requests: Map<
    number,
    {
      resolve: (content: ChapterContent) => void;
      reject: (error: Error) => void;
    }
  >;
  nextRequestId: number;
  readonly search: ReturnType<typeof createSearch>;
  readonly speech: ReturnType<typeof createSpeech>;
  readonly images: ReturnType<typeof createImageViewer>;
  stopAutoScroll?: () => void;
  lastInteraction: number;
  selectionTimer?: ReturnType<typeof setTimeout>;
  hasSelection: boolean;
  clock?: ReturnType<typeof setInterval>;
  appliedStyles: string;
  holdRelocation: boolean;
  // Where a late layout change should return to; cleared once the reader moves.
  sentTo?: ReaderLocation | Range | Element;
  respread: number;
}

export const log = (
  state: ReaderState,
  level: 'log' | 'warn' | 'error',
  message: string,
) => state.bridge.send({ type: 'log', level, message });

export const currentChapter = (state: ReaderState) =>
  state.location ? state.book?.chapters[state.location.index] : undefined;

export const currentLocation = (
  state: ReaderState,
): ReaderLocation | undefined => {
  const chapter = currentChapter(state);
  return chapter && state.location
    ? { chapterId: chapter.id, fraction: state.location.fraction }
    : undefined;
};

export const primaryDocument = (state: ReaderState): Document | undefined => {
  const paginator = state.paginator;
  if (!paginator) {
    return undefined;
  }
  const contents = paginator.getContents();
  const index = state.location?.index ?? paginator.primaryIndex;
  return (contents.find(content => content.index === index) ?? contents[0])
    ?.doc;
};
