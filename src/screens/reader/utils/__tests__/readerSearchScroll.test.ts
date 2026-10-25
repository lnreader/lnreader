import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type ScrollOptions = { top: number; behavior: string };

/** Loads the reader's search against a simulated 800px viewport. */
const loadReaderSearch = (chapterTop: number) => {
  const source = readFileSync(
    join(process.cwd(), 'assets/reader/js/search.js'),
    'utf8',
  );
  const scrolls: ScrollOptions[] = [];
  const window: Record<string, unknown> = {
    scrollY: chapterTop,
    scrollTo: (options: ScrollOptions) => scrolls.push(options),
  };
  runInNewContext(source, {
    window,
    reader: {
      generalSettings: { val: { pageReader: false } },
      layoutHeight: 800,
      chapterTop,
    },
    document: {},
    van: { state: (val: unknown) => ({ val }) },
    requestAnimationFrame: (callback: () => void) => callback(),
    console,
  });
  const readerSearch = window.readerSearch as {
    scrollToMatch(match: unknown): void;
  };
  /** A match whose top is `top` pixels below the document origin. */
  const matchAt = (top: number) => ({
    offsetHeight: 20,
    getBoundingClientRect: () => ({ top: top - (window.scrollY as number) }),
  });
  return { readerSearch, scrolls, matchAt };
};

describe('reader search scrolling', () => {
  it('keeps the top of the screen inside the current chapter for a match near its start', () => {
    const { readerSearch, scrolls, matchAt } = loadReaderSearch(5000);

    readerSearch.scrollToMatch(matchAt(5210));

    expect(scrolls).toEqual([{ top: 5000, behavior: 'smooth' }]);
  });

  it('still centers a match further into the chapter', () => {
    const { readerSearch, scrolls, matchAt } = loadReaderSearch(5000);

    readerSearch.scrollToMatch(matchAt(6000));

    expect(scrolls).toEqual([{ top: 5610, behavior: 'smooth' }]);
  });
});
