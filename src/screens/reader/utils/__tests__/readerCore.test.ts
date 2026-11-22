import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * Loads the real reader page scripts into jsdom. jsdom has no layout engine,
 * so the few measurements the reader takes are stubbed with fixed sizes.
 */

type Posted = { type: string; data?: unknown; chapterId?: number };

type ReaderWindow = Window & {
  reader: any;
  tts: any;
  pageReader: any;
  readerSearch: any;
  lnApplyCustomJS?: () => void;
};

const SCRIPTS = [
  'icons.js',
  'van.js',
  'text-vibe.js',
  'core.js',
  'search.js',
  'index.js',
  'textRemover.js',
].map(file =>
  readFileSync(join(process.cwd(), 'assets/reader/js', file), 'utf8'),
);

const VIEWPORT = { width: 400, height: 800 };
const CHAPTER_HEIGHT = 10000;

const makeChapter = (id: number, progress: number) => ({
  id,
  novelId: 1,
  name: `Chapter ${id}`,
  progress,
  path: `/chapter-${id}`,
});

const strings = {
  finished: 'Finished',
  noNextChapter: 'No next chapter',
  removeText: 'Remove',
  replaceText: 'Replace',
};

const settle = (window: ReaderWindow, ms = 40) =>
  new Promise<void>(resolve => window.setTimeout(resolve, ms));

const loadReader = async ({
  pageReader = false,
  customJS = '',
}: { pageReader?: boolean; customJS?: string } = {}) => {
  const posted: Posted[] = [];
  const scrollCalls: number[] = [];
  const listenerCount = { value: 0 };
  const errors: unknown[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', error => errors.push(error));
  virtualConsole.on('jsdomError', error => errors.push(error));
  const chapter = makeChapter(1, 50);

  const dom = new JSDOM(
    `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width">
    </head><body>
      <div class="transition-chapter">${chapter.name}</div>
      <div id="LNReader-chapter"><p>First chapter</p></div>
      <div id="reader-ui"></div>
      <script>
        var initialPageReaderConfig = { nextChapterScreenVisible: false };
        var initialReaderConfig = ${JSON.stringify({
          readerSettings: { theme: '#000', fontFamily: '', tts: {} },
          chapterGeneralSettings: { pageReader, TTSEnable: true },
          novel: { id: 1, name: 'Novel' },
          chapter,
          batteryLevel: 1,
          autoSaveInterval: 2222,
          DEBUG: false,
          strings,
        })};
      </script>
      ${SCRIPTS.map(code => `<script>${code}</script>`).join('\n')}
      ${customJS ? `<script>${customJS}</script>` : ''}
    </body></html>`,
    {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole,
      beforeParse(window) {
        const win = window as any;
        win.ReactNativeWebView = {
          postMessage: (message: string) => posted.push(JSON.parse(message)),
        };
        win.ResizeObserver = class {
          observe() {}
          disconnect() {}
        };
        win.FontFace = class {
          load() {
            return Promise.resolve(this);
          }
        };
        Object.defineProperty(win.document, 'fonts', {
          value: {
            ready: Promise.resolve(),
            add() {},
            delete() {},
            forEach() {},
          },
        });
        Object.defineProperty(win, 'innerWidth', { value: VIEWPORT.width });
        Object.defineProperty(win, 'innerHeight', { value: VIEWPORT.height });
        Object.defineProperty(win, 'scrollY', { value: 0, writable: true });
        win.scrollTo = ({ top }: { top: number }) => {
          scrollCalls.push(top);
          win.scrollY = Math.max(0, top);
        };
        win.scrollBy = () => {};
        win.Element.prototype.scrollIntoView = () => {};
        const isChapter = (el: Element) => el.id === 'LNReader-chapter';
        Object.defineProperty(win.HTMLElement.prototype, 'scrollHeight', {
          get() {
            return isChapter(this) ? CHAPTER_HEIGHT : 0;
          },
        });
        Object.defineProperty(win.HTMLElement.prototype, 'scrollWidth', {
          get() {
            // Five pages worth of columns in page reader mode.
            return isChapter(this) ? VIEWPORT.width * 5 : 0;
          },
        });
        Object.defineProperty(win.HTMLElement.prototype, 'clientWidth', {
          get() {
            return isChapter(this) ? VIEWPORT.width : 0;
          },
        });
        for (const target of [win, win.document]) {
          const add = target.addEventListener.bind(target);
          target.addEventListener = (...args: any[]) => {
            listenerCount.value++;
            return add(...args);
          };
        }
      },
    },
  );

  const window = dom.window as unknown as ReaderWindow;
  await settle(window);

  const setChapter = async (
    id: number,
    progress: number,
    html: string,
    nextChapterScreenVisible = false,
  ) => {
    window.reader.setChapter({
      chapter: makeChapter(id, progress),
      novel: { id: 1, name: 'Novel' },
      html,
      strings: { ...strings, finished: `Finished: Chapter ${id}` },
      nextChapterScreenVisible,
    });
    await settle(window);
  };

  return {
    window,
    posted,
    scrollCalls,
    listenerCount,
    setChapter,
    chapterElement: () =>
      window.document.querySelector('#LNReader-chapter') as HTMLElement,
    transition: () =>
      window.document.querySelector('.transition-chapter') as HTMLElement & {
        innerText: string;
      },
    close: () => {
      dom.window.close();
      expect(errors).toEqual([]);
    },
  };
};

const restoredTop = (progress: number) =>
  (CHAPTER_HEIGHT * progress) / 100 - VIEWPORT.height;

describe('reader.setChapter', () => {
  it('replaces the chapter and restores its reading position', async () => {
    const page = await loadReader();
    expect(page.scrollCalls.at(-1)).toBe(restoredTop(50));

    const changes: unknown[] = [];
    page.window.document.addEventListener('ln:chapter-change', e =>
      changes.push((e as CustomEvent).detail.chapter.id),
    );
    await page.setChapter(2, 30, '<p>Second chapter</p>');

    expect(page.chapterElement().innerHTML).toBe('<p>Second chapter</p>');
    expect(page.transition().innerText).toBe('Chapter 2');
    expect(page.window.reader.chapter.id).toBe(2);
    expect(page.window.reader.strings.finished).toBe('Finished: Chapter 2');
    expect(page.window.reader.nextChapter).toBeUndefined();
    expect(page.scrollCalls.at(-1)).toBe(restoredTop(30));
    expect(changes).toEqual([2]);
    expect(page.posted).toContainEqual({ type: 'chapter-shown', chapterId: 2 });
    expect(page.window.document.body.textContent).toContain(
      'Finished: Chapter 2',
    );
    page.close();
  });

  it('never saves progress of the replaced chapter under the new one', async () => {
    const page = await loadReader({ pageReader: true });
    page.window.reader.setAdjacentChapters({
      nextChapter: makeChapter(2, 0),
    });
    // Paging past the last page schedules a delayed request for the next
    // chapter; a chapter swapped in meanwhile must cancel it.
    page.window.pageReader.movePage(page.window.pageReader.totalPages.val);
    await page.setChapter(3, 0, '<p>Third chapter</p>');
    await settle(page.window, 250);

    expect(page.posted.filter(event => event.type === 'next')).toEqual([]);

    page.posted.length = 0;
    page.window.pageReader.movePage(3);
    expect(page.posted).toContainEqual({
      type: 'save',
      data: 80,
      chapterId: 3,
    });
    page.close();
  });

  it('tags scroll-mode saves with the chapter on screen', async () => {
    const page = await loadReader();
    await page.setChapter(2, 10, '<p>Second chapter</p>');
    page.posted.length = 0;

    page.window.document.onscrollend?.({} as Event);

    expect(page.posted).toContainEqual(
      expect.objectContaining({ type: 'save', chapterId: 2 }),
    );
    page.close();
  });

  it('paginates the new chapter at its saved page in page reader mode', async () => {
    const page = await loadReader({ pageReader: true });
    expect(page.window.pageReader.totalPages.val).toBe(5);

    await page.setChapter(2, 50, '<p>Second chapter</p>');

    // round(5 pages * 50%) - 1
    expect(page.window.pageReader.page.val).toBe(2);
    expect(page.chapterElement().style.transform).toBe('translateX(-200%)');
    expect(page.window.pageReader.chapterEndingVisible.val).toBe(false);
    page.close();
  });

  it('keeps the next-chapter screen up when the app asks for it', async () => {
    const page = await loadReader({ pageReader: true });

    await page.setChapter(2, 50, '<p>Second chapter</p>', true);

    expect(page.window.pageReader.chapterEndingVisible.val).toBe(true);
    expect(page.window.pageReader.page.val).toBe(0);
    expect(page.chapterElement().style.transform).toBe('');
    page.close();
  });

  it('resets TTS and search state that pointed into the old chapter', async () => {
    const page = await loadReader();
    page.window.tts.setPlaybackState('playing');
    page.window.tts.setActiveIndex(0);
    page.window.readerSearch.query = 'chapter';
    page.window.readerSearch.index = 0;

    await page.setChapter(2, 0, '<p>Second chapter</p>');

    expect(page.window.tts.started).toBe(false);
    expect(page.window.tts.currentElement).toBe(page.chapterElement());
    expect(page.window.readerSearch.query).toBe('');
    expect(page.window.readerSearch.index).toBe(-1);
    // Resetting must not tell the app to stop TTS: auto page advance keeps
    // playing across the chapter change.
    expect(page.posted).not.toContainEqual(
      expect.objectContaining({ type: 'tts-command' }),
    );
    page.close();
  });

  it("re-runs the user's custom JS on the new chapter", async () => {
    const page = await loadReader({
      customJS: `window.lnApplyCustomJS = () => {
        const el = document.querySelector('#LNReader-chapter');
        el.innerHTML = el.innerHTML.replace('chapter', 'CHAPTER');
      };`,
    });

    await page.setChapter(2, 0, '<p>Second chapter</p>');

    expect(page.chapterElement().innerHTML).toBe('<p>Second CHAPTER</p>');
    expect(page.window.reader.rawHTML).toBe('<p>Second chapter</p>');
    page.close();
  });

  it('reports a failed swap so the app can reload the page', async () => {
    const page = await loadReader();

    page.window.reader.setChapter({ chapter: null });

    expect(page.posted).toContainEqual(
      expect.objectContaining({ type: 'chapter-swap-failed' }),
    );
    page.close();
  });

  it('does not add listeners per chapter', async () => {
    const page = await loadReader();
    const listenersAfterLoad = page.listenerCount.value;

    for (let id = 2; id < 27; id++) {
      await page.setChapter(id, id % 100, `<p>Chapter ${id}</p>`);
    }

    expect(page.listenerCount.value).toBe(listenersAfterLoad);
    expect(
      page.posted.filter(event => event.type === 'chapter-shown'),
    ).toHaveLength(25);
    page.close();
  });
});
