import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

/**
 * A block-level element in a single-column page: each one starts where the
 * previous visible one ends.
 */
class LayoutElement {
  innerHTML = '';
  className = '';
  textContent = '';
  dataset: Record<string, unknown> = {};
  style = {
    display: '',
    removeProperty: (name: 'display') => {
      this.style[name] = '';
    },
  };

  constructor(private readonly page: Page, public height = 0) {}

  get offsetTop() {
    let top = 0;
    for (const element of this.page.elements) {
      if (element === this) {
        return top;
      }
      top += element.renderedHeight;
    }
    throw new Error('Element is not in the page');
  }

  get renderedHeight() {
    return this.style.display === 'none' ? 0 : this.height;
  }

  getBoundingClientRect() {
    const top = this.offsetTop - this.page.scrollY;
    return { top, bottom: top + this.renderedHeight };
  }

  remove() {
    this.page.elements.splice(this.page.elements.indexOf(this), 1);
  }
}

class Page {
  elements: LayoutElement[] = [];
  scrollY = 0;
  readonly layoutHeight = 800;

  get scrollHeight() {
    return this.elements.reduce((sum, el) => sum + el.renderedHeight, 0);
  }

  scrollTo(top: number) {
    this.scrollY = Math.max(
      0,
      Math.min(top, this.scrollHeight - this.layoutHeight),
    );
  }
}

type Chapter = { id: number; name: string };
type Segment = { chapter: Chapter; element: LayoutElement };
type ContinuousScroll = {
  status: { val: string };
  update(): void;
  trim(): void;
  collapse(): void;
  append(answer: {
    afterChapterId: number;
    chapter: Chapter;
    html: string;
  }): void;
};

/** The part of `window.reader` that infinite scrolling relies on. */
type SimulatedReader = {
  generalSettings: { val: { infiniteScroll: boolean; pageReader: boolean } };
  segments: Segment[];
  hostSegment: Segment;
  chapter: Chapter;
  chapterElement: LayoutElement;
  chapterTop: number;
  chapterHeight: number;
  layoutHeight: number;
  post(message: Record<string, unknown>): void;
  chapterEnds(): number[];
  measureChapter(ends?: number[]): void;
  renderChapterHTML(segment: { element: LayoutElement }): void;
  attachChapterGestures(): void;
  refresh(): void;
};

const CHAPTER_HEIGHT = 1000;
const DIVIDER_HEIGHT = 100;

/** Loads the reader's infinite scrolling against a simulated page. */
const loadContinuousScroll = () => {
  const core = readFileSync(
    join(process.cwd(), 'assets/reader/js/core.js'),
    'utf8',
  );
  const start = core.indexOf('window.continuousScroll = new (function () {');
  const end = core.indexOf('\n})();', start);
  if (start < 0 || end < 0) {
    throw new Error('Could not locate the infinite scrolling implementation');
  }

  const page = new Page();
  const readerUI = new LayoutElement(page);
  const host = new LayoutElement(page, CHAPTER_HEIGHT);
  page.elements.push(host, readerUI);

  const posts: Record<string, unknown>[] = [];
  const hostSegment = { chapter: { id: 1, name: '1' }, element: host };
  const reader: SimulatedReader = {
    generalSettings: { val: { infiniteScroll: true, pageReader: false } },
    segments: [hostSegment],
    hostSegment,
    chapter: hostSegment.chapter,
    chapterElement: host,
    chapterTop: 0,
    chapterHeight: CHAPTER_HEIGHT,
    layoutHeight: page.layoutHeight,
    post: message => {
      posts.push(message);
    },
    chapterEnds: () =>
      reader.segments.map(
        segment =>
          segment.element.getBoundingClientRect().bottom + page.scrollY,
      ),
    measureChapter: (ends = reader.chapterEnds()) => {
      const index = reader.segments.findIndex(
        segment => segment.element === reader.chapterElement,
      );
      reader.chapterTop = index > 0 ? ends[index - 1] : 0;
      reader.chapterHeight = ends[index] - reader.chapterTop;
    },
    renderChapterHTML: segment => {
      segment.element.height = CHAPTER_HEIGHT;
    },
    attachChapterGestures: () => {},
    refresh: () => {},
  };

  const window: {
    continuousScroll?: ContinuousScroll;
    scrollY: number;
    scrollTo(options: { top: number }): void;
  } = {
    get scrollY() {
      return page.scrollY;
    },
    scrollTo: ({ top }) => page.scrollTo(top),
  };

  const document = {
    documentElement: {
      get scrollHeight() {
        return page.scrollHeight;
      },
    },
    body: {
      insertBefore: (element: LayoutElement, before: LayoutElement) => {
        if (element.className === 'continuous-chapter-divider') {
          element.height = DIVIDER_HEIGHT;
        }
        page.elements.splice(page.elements.indexOf(before), 0, element);
      },
    },
    createElement: () => new LayoutElement(page),
    getElementById: () => readerUI,
    querySelectorAll: () =>
      page.elements.filter(element =>
        ['continuous-chapter-divider', 'LNReader-chapter-continued'].includes(
          element.className,
        ),
      ),
  };

  runInNewContext(core.slice(start, end + '\n})();'.length), {
    window,
    document,
    reader,
    tts: { started: false },
    van: {
      state: (val: unknown) => ({ val }),
      derive: () => {},
    },
    requestAnimationFrame: () => 0,
    console,
  });

  const continuousScroll = window.continuousScroll!;
  /** Scrolls to `top`, then lets infinite scrolling react as it would. */
  const scrollTo = (top: number) => {
    page.scrollTo(top);
    continuousScroll.update();
  };
  /** Answers the outstanding request for the chapter after `afterChapterId`. */
  const answer = (afterChapterId: number) =>
    continuousScroll.append({
      afterChapterId,
      chapter: { id: afterChapterId + 1, name: String(afterChapterId + 1) },
      html: '',
    });
  const requests = () =>
    posts.filter(message => message.type === 'continuous-next');

  return { continuousScroll, reader, page, posts, scrollTo, answer, requests };
};

describe('reader infinite scrolling', () => {
  it('asks for the next chapter again after switching to paged mode mid-load and back', () => {
    const { continuousScroll, reader, scrollTo, answer, requests } =
      loadContinuousScroll();

    scrollTo(200);
    expect(requests()).toEqual([{ type: 'continuous-next', chapterId: 1 }]);

    reader.generalSettings.val = { infiniteScroll: true, pageReader: true };
    continuousScroll.collapse();
    // The answer to the request arrives while paged mode is on.
    answer(1);
    expect(reader.segments).toHaveLength(1);

    reader.generalSettings.val = { infiniteScroll: true, pageReader: false };
    scrollTo(200);
    expect(requests()).toHaveLength(2);
    expect(continuousScroll.status.val).toBe('loading');
  });

  it('keeps one chapter above the current one and holds the text on screen still', () => {
    const { continuousScroll, reader, page, posts, scrollTo, answer } =
      loadContinuousScroll();

    scrollTo(200);
    answer(1);
    scrollTo(1300);
    answer(2);
    scrollTo(2300);
    answer(3);
    // Into chapter 4, three chapters below the first.
    scrollTo(3500);
    expect(reader.chapter.id).toBe(4);

    const current = reader.chapterElement;
    const topBefore = current.getBoundingClientRect().top;
    continuousScroll.trim();

    expect(reader.segments.map(segment => segment.chapter.id)).toEqual([3, 4]);
    expect(current.getBoundingClientRect().top).toBe(topBefore);
    expect(page.scrollY).toBeLessThan(3500);
    expect(posts).toContainEqual({ type: 'chapters-dropped', data: [1, 2] });

    // Chapter 4 stays the current one once scrolling resumes.
    const changes = posts.filter(m => m.type === 'chapter-change').length;
    scrollTo(page.scrollY + 10);
    expect(reader.chapter.id).toBe(4);
    expect(posts.filter(m => m.type === 'chapter-change')).toHaveLength(
      changes,
    );
  });
});
