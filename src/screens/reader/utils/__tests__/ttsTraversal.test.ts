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
  normalizeText: (text: string) => string;
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

  // normalizeSharedText doesn't exist on this base — the tts object defines
  // this.normalizeText inline (line ~212), which IS the shared normalizer
  // post-#1576 refactor. The tts slice already contains it.
  runInNewContext(core.slice(start, end + closing.length), context);

  if (!context.window.tts) {
    throw new Error('Reader TTS implementation did not initialize');
  }

  return context.window.tts;
};

const getQueuedText = (chapter: TestElement): string[] =>
  loadTtsTraversal(chapter)
    .getAllReadableElements(chapter)
    .map(readableElement => readableElement.innerText);

describe('reader TTS traversal', () => {
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

  it('strips leading and trailing quotes from normalized text (#2008)', () => {
    const { normalizeText } = loadTtsTraversal(
      element('div', element('p', element('span', text('placeholder')))),
    );

    // Straight, curly, and mixed quote pairs — including a lone trailing
    // quote from an unclosed quotation spanning paragraphs.
    expect(normalizeText('"Hello there."')).toBe('Hello there.');
    expect(normalizeText('“Hello there.”')).toBe('Hello there.');
    expect(normalizeText("'tis the season'")).toBe('tis the season');
    expect(normalizeText('He said “run!”’')).toBe('He said “run!');
    // Interior quotes are untouched.
    expect(normalizeText('The "best" part')).toBe('The "best" part');
    // Whitespace handling matches upstream PR #1869's ordering: the quote
    // strip runs before whitespace collapse, so only quotes adjacent to the
    // string edges are removed. Real chapter innerText rarely has padding,
    // so we pin the faithful adjacency behavior rather than inventing
    // stricter semantics.
    expect(normalizeText('"Padded quote."')).toBe('Padded quote.');
  });
});
