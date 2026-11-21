import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type TestNode = TestElement | { nodeName: '#text'; text: string };
type TestNodeList = TestNode[] & { item(index: number): TestNode };

class TestElement {
  readonly childNodes: TestNodeList;
  readonly children: TestElement[];

  constructor(readonly nodeName: string, childNodes: TestNode[]) {
    this.childNodes = [...childNodes] as TestNodeList;
    this.childNodes.item = index => this.childNodes[index];
    this.children = childNodes.filter(
      (node): node is TestElement => node instanceof TestElement,
    );
  }

  hasChildNodes() {
    return this.childNodes.length > 0;
  }

  get innerText(): string {
    return this.childNodes
      .map(node => (node instanceof TestElement ? node.innerText : node.text))
      .join('');
  }
}

type TtsTraversal = {
  getAllReadableElements(element: TestElement): TestElement[];
  normalizeText(text: string): string;
  next(): void;
  pause(): void;
  previous(): void;
  resume(): void;
  setActiveIndex(index: number): void;
  setPlaybackState(state: string): void;
  started: boolean;
  textQueue: string[];
  totalElements: number;
};

type TtsPostEvent = {
  type: string;
  data?: { command?: string };
};

const text = (value: string): TestNode => ({
  nodeName: '#text',
  text: value,
});

const element = (name: string, ...children: TestNode[]) =>
  new TestElement(name.toUpperCase(), children);

const loadTtsTraversal = (
  chapterElement: TestElement,
  postedEvents: TtsPostEvent[] = [],
): TtsTraversal => {
  const core = readFileSync(
    join(process.cwd(), 'assets/reader/js/core.js'),
    'utf8',
  );
  const start = core.indexOf('window.tts = new (function () {');
  const closing = '\n})();';
  const end = core.indexOf(closing, start);

  if (start < 0 || end < 0) {
    throw new Error('Could not locate the reader TTS implementation');
  }

  const context: {
    document: { getElementById(): null };
    reader: {
      chapterElement: TestElement;
      post(event: TtsPostEvent): void;
    };
    window: { tts?: TtsTraversal };
  } = {
    document: { getElementById: () => null },
    reader: {
      chapterElement,
      post: event => postedEvents.push(event),
    },
    window: {},
  };

  runInNewContext(core.slice(start, end + closing.length), context);

  if (!context.window.tts) {
    throw new Error('Reader TTS implementation did not initialize');
  }

  return context.window.tts;
};

const getQueuedText = (chapter: TestElement): string[] => {
  const tts = loadTtsTraversal(chapter);
  return tts
    .getAllReadableElements(chapter)
    .map(readableElement => tts.normalizeText(readableElement.innerText))
    .filter(Boolean);
};

describe('reader TTS traversal', () => {
  describe('text normalization', () => {
    const tts = loadTtsTraversal(element('div'));

    it.each([
      ['"Hello world."', 'Hello world.'],
      ["'Hello world.'", 'Hello world.'],
      ['“Hello world.”', 'Hello world.'],
      ['‘Hello world.’', 'Hello world.'],
    ])('removes surrounding quotes from %s', (input, expected) => {
      expect(tts.normalizeText(input)).toBe(expected);
    });

    it('removes quotes after trimming surrounding whitespace', () => {
      expect(tts.normalizeText('  “Hello   world.”\n')).toBe('Hello world.');
    });

    it('preserves quotes within a paragraph', () => {
      expect(tts.normalizeText('He said “hello” before leaving.')).toBe(
        'He said “hello” before leaving.',
      );
    });

    it.each(['---', '————', '— — —', '−−−', '⁓⁓⁓', '⸺⸺⸺', '⸻⸻⸻'])(
      'skips dash-only divider %s',
      input => {
        expect(tts.normalizeText(input)).toBe('');
      },
    );

    it.each(['—', '— Hello', 'Wait---what?'])(
      'preserves prose punctuation %s',
      input => {
        expect(tts.normalizeText(input)).toBe(input);
      },
    );
  });

  it('queues paragraphs wrapped in spans only once', () => {
    const chapter = element(
      'div',
      element('p', element('span', text('First paragraph'))),
      element('p', element('span', text('Second paragraph'))),
    );

    expect(getQueuedText(chapter)).toEqual([
      'First paragraph',
      'Second paragraph',
    ]);
  });

  it('does not queue nested formatting separately from its paragraph', () => {
    const chapter = element(
      'div',
      element(
        'p',
        element('span', text('Text with '), element('em', text('emphasis'))),
      ),
    );

    expect(getQueuedText(chapter)).toEqual(['Text with emphasis']);
  });

  it('preserves separate paragraphs that intentionally have identical text', () => {
    const chapter = element(
      'div',
      element('p', element('span', text('Repeated paragraph'))),
      element('p', element('span', text('Repeated paragraph'))),
    );

    expect(getQueuedText(chapter)).toEqual([
      'Repeated paragraph',
      'Repeated paragraph',
    ]);
  });

  it('continues through non-readable containers to separate paragraphs', () => {
    const chapter = element(
      'div',
      element(
        'section',
        element('p', text('First paragraph')),
        element('p', text('Second paragraph')),
      ),
    );

    expect(getQueuedText(chapter)).toEqual([
      'First paragraph',
      'Second paragraph',
    ]);
  });

  it('does not queue dash-only divider paragraphs', () => {
    const chapter = element(
      'div',
      element('p', text('First paragraph')),
      element('p', text('----------------')),
      element('p', text('Second paragraph')),
    );

    expect(getQueuedText(chapter)).toEqual([
      'First paragraph',
      'Second paragraph',
    ]);
  });

  it('reattaches reader controls to an active native session', () => {
    const chapter = element(
      'div',
      element('p', text('First paragraph')),
      element('p', text('Second paragraph')),
    );
    const postedEvents: TtsPostEvent[] = [];
    const tts = loadTtsTraversal(chapter, postedEvents);

    tts.setPlaybackState('playing');

    expect(tts.started).toBe(true);
    expect(tts.totalElements).toBe(2);
    expect(tts.textQueue).toEqual(['First paragraph', 'Second paragraph']);

    tts.pause();
    tts.next();
    tts.previous();
    tts.setPlaybackState('paused');
    tts.resume();

    expect(postedEvents).toEqual([
      { type: 'tts-command', data: { command: 'pause' } },
      { type: 'tts-command', data: { command: 'next' } },
      { type: 'tts-command', data: { command: 'previous' } },
      { type: 'tts-command', data: { command: 'play' } },
    ]);
    expect(postedEvents).not.toContainEqual(
      expect.objectContaining({ type: 'tts-queue' }),
    );
  });

  it('does not reattach from stale progress after the native session stops', () => {
    const tts = loadTtsTraversal(
      element('div', element('p', text('First paragraph'))),
    );

    tts.setActiveIndex(0);

    expect(tts.started).toBe(false);
    expect(tts.totalElements).toBe(0);
    expect(tts.textQueue).toEqual([]);
  });
});
