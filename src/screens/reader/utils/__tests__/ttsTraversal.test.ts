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

  describe('symbol stripping (issue 2063)', () => {
    const tts = loadTtsTraversal(element('div'));

    it('strips brackets from system status text but keeps the words', () => {
      expect(tts.normalizeText('[Ding! Host has connected.]')).toBe(
        'Ding! Host has connected.',
      );
    });

    it('keeps a meaningful question mark in hidden-status markers', () => {
      expect(tts.normalizeText('[?]')).toBe('?');
    });

    it.each([
      ['Success rate 99%', 'Success rate 99%'],
      ['$50', '$50'],
      ['ATK +5', 'ATK +5'],
      ['HP 100/100', 'HP 100/100'],
      ['Tom & Jerry', 'Tom & Jerry'],
      ['@reader', '@reader'],
      ['ユーザー＠example', 'ユーザー＠example'],
      // @ survives; the pre-existing prose-dot spacing still applies.
      ['reader@example.com', 'reader@example. com'],
    ])('preserves meaning-bearing symbols in %s', (input, expected) => {
      expect(tts.normalizeText(input)).toBe(expected);
    });

    it.each([
      ['["Status"]', 'Status'],
      ['[“Skill acquired”]', 'Skill acquired'],
    ])('strips quotes exposed by bracket removal in %s', (input, expected) => {
      expect(tts.normalizeText(input)).toBe(expected);
    });

    it('preserves CJK sentence boundaries', () => {
      expect(tts.normalizeText('你好。再见。')).toBe('你好。再见。');
    });

    it('preserves other meaning-bearing glyphs and CJK punctuation', () => {
      expect(tts.normalizeText('It is 36°')).toBe('It is 36°');
      expect(tts.normalizeText('§ 12')).toBe('§ 12');
      expect(tts.normalizeText('a · b')).toBe('a · b');
      expect(tts.normalizeText('「你好，世界。」')).toBe('「你好，世界。」');
      expect(tts.normalizeText('（注）【第12章】')).toBe('（注）【第12章】');
    });

    it.each([
      ['€50', '€50'],
      ['¥5000', '¥5000'],
      ['3×4', '3×4'],
      ['10÷2', '10÷2'],
      ['HP<30%', 'HP<30%'],
      ['a>b', 'a>b'],
      ['HP≤30%', 'HP≤30%'],
      ['a≥b', 'a≥b'],
      ['a≈b', 'a≈b'],
      ['a≠b', 'a≠b'],
      ['ATK ±5', 'ATK ±5'],
      ['50‰', '50‰'],
      ['５＋３', '５＋３'],
      ['１００／１００', '１００／１００'],
      ['５０％', '５０％'],
      ['＆', '＆'],
      ['￥5000', '￥5000'],
      ['＄50', '＄50'],
      ['LV.10〜20', 'LV. 10〜20'],
      ['10～20', '10～20'],
      ['√9', '√9'],
      ['1⁄2', '1⁄2'],
      ['3⋅5', '3⋅5'],
      ['50‱', '50‱'],
      ['5′10″', '5′10″'],
      ['HP ∞', 'HP ∞'],
    ])(
      'preserves sibling currencies, relations, and fullwidth math in %s',
      (input, expected) => {
        expect(tts.normalizeText(input)).toBe(expected);
      },
    );

    it('strips asterisk emphasis but keeps the word', () => {
      expect(tts.normalizeText('*Important* announcement')).toBe(
        'Important announcement',
      );
    });

    it('strips bullets and decorative glyphs', () => {
      expect(tts.normalizeText('• First item')).toBe('First item');
      expect(tts.normalizeText('❖ ✦ ★ Chapter 12 ★ ✦ ❖')).toBe('Chapter 12');
    });

    it('folds ellipses marking hesitation or silence into a pause', () => {
      expect(tts.normalizeText('He hesitated... then spoke.')).toBe(
        'He hesitated… then spoke.',
      );
    });

    it('drops symbol-only paragraphs from the queue', () => {
      expect(tts.normalizeText('✦✦✦')).toBe('');
      expect(tts.normalizeText('***')).toBe('');
    });
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
});
