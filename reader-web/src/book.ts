import type { ReaderSection } from '../../src/screens/reader/engine/protocol';
import type { FoliateBook, FoliateSection } from './types';

/** The paginator reloads sections trimmed from the cache. */
const CACHE_LIMIT = 12;

export interface Book extends FoliateBook {
  readonly chapters: ReaderSection[];
  append(chapters: readonly ReaderSection[]): void;
  indexOf(chapterId: number): number;
  invalidate(chapterId?: number): void;
  /**
   * Hides the sections past a chapter that failed to load (in the given
   * direction) until it loads, so continuous scrolling stops at its error
   * instead of fetching every chapter after it.
   */
  setFailed(chapterId: number, failed: boolean, side: 1 | -1): void;
}

// Sections are only ever appended: the paginator addresses them by index.
export const createBook = (
  load: (section: ReaderSection) => Promise<string>,
  dir: 'ltr' | 'rtl',
): Book => {
  const sections: FoliateSection[] = [];
  const chapters: ReaderSection[] = [];
  const cache = new Map<number, Promise<string>>();
  const failed = new Map<number, 1 | -1>();

  const updateLinear = () => {
    const indices = [...failed].map(([id, side]) => ({
      at: chapters.findIndex(chapter => chapter.id === id),
      side,
    }));
    sections.forEach((section, index) => {
      const hidden = indices.some(({ at, side }) =>
        side === 1 ? index > at : index < at,
      );
      section.linear = hidden ? 'no' : 'yes';
    });
  };

  const content = (chapterId: number): Promise<string> => {
    const cached = cache.get(chapterId);
    if (cached) {
      cache.delete(chapterId);
      cache.set(chapterId, cached);
      return cached;
    }
    const chapter = chapters.find(item => item.id === chapterId);
    if (!chapter) {
      return Promise.reject(new Error(`Unknown chapter ${chapterId}`));
    }
    const pending = load(chapter);
    pending.catch(() => cache.delete(chapterId));
    cache.set(chapterId, pending);
    while (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      cache.delete(oldest);
    }
    return pending;
  };

  return {
    sections,
    chapters,
    dir,
    append: added => {
      const known = new Set(chapters.map(chapter => chapter.id));
      for (const chapter of added) {
        if (known.has(chapter.id)) {
          continue;
        }
        known.add(chapter.id);
        chapters.push(chapter);
        sections.push({
          id: chapter.id,
          linear: 'yes',
          size: 1,
          load: () => 'about:srcdoc',
          loadContent: () => content(chapter.id),
          createDocument: async () =>
            new DOMParser().parseFromString(
              await content(chapter.id),
              'text/html',
            ),
        });
      }
      if (failed.size) {
        updateLinear();
      }
    },
    indexOf: chapterId =>
      chapters.findIndex(chapter => chapter.id === chapterId),
    invalidate: chapterId => {
      if (chapterId === undefined) {
        cache.clear();
      } else {
        cache.delete(chapterId);
      }
    },
    setFailed: (chapterId, isFailed, side) => {
      if (isFailed === failed.has(chapterId)) {
        return;
      }
      if (isFailed) {
        failed.set(chapterId, side);
      } else {
        failed.delete(chapterId);
      }
      updateLinear();
    },
  };
};
