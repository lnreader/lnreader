import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type TestNode = TestElement | { nodeName: '#text'; text: string };
type TestNodeList = TestNode[] & { item(index: number): TestNode };

class TestElement {
  readonly childNodes: TestNodeList;
  readonly children: TestElement[];
  parentElement: TestElement | null = null;

  constructor(readonly nodeName: string, childNodes: TestNode[]) {
    this.childNodes = [...childNodes] as TestNodeList;
    this.childNodes.item = index => this.childNodes[index];
    this.children = childNodes.filter(
      (node): node is TestElement => node instanceof TestElement,
    );
    this.children.forEach(child => {
      child.parentElement = this;
    });
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
  getStartIndex(
    element: TestElement | undefined,
    readableElements: TestElement[],
  ): number;
  resolveReadableElement(element: TestElement): TestElement | null;
};

const text = (value: string): TestNode => ({
  nodeName: '#text',
  text: value,
});

const element = (name: string, ...children: TestNode[]) =>
  new TestElement(name.toUpperCase(), children);

const loadTtsTraversal = (chapterElement: TestElement): TtsTraversal => {
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
    reader: { chapterElement: TestElement };
    window: { tts?: TtsTraversal };
  } = {
    reader: { chapterElement },
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

  it('resolves nested formatting to its queued paragraph', () => {
    const firstSpan = element('span', text('First paragraph'));
    const secondSpan = element('span', text('Second paragraph'));
    const firstParagraph = element('p', firstSpan);
    const secondParagraph = element('p', secondSpan);
    const chapter = element('div', firstParagraph, secondParagraph);
    const tts = loadTtsTraversal(chapter);
    const readableElements = tts.getAllReadableElements(chapter);

    expect(tts.resolveReadableElement(secondSpan)).toBe(secondParagraph);
    expect(tts.getStartIndex(secondSpan, readableElements)).toBe(1);
  });

  it('does not fall back to the chapter start for an invalid target', () => {
    const chapter = element('div', element('p', text('Chapter paragraph')));
    const detachedParagraph = element('p', text('Detached paragraph'));
    const tts = loadTtsTraversal(chapter);
    const readableElements = tts.getAllReadableElements(chapter);

    expect(tts.resolveReadableElement(detachedParagraph)).toBeNull();
    expect(tts.getStartIndex(detachedParagraph, readableElements)).toBe(-1);
  });
});
