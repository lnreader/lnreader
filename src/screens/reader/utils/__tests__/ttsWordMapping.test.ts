import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type DomNode = TestElement | TestTextNode;
type DomNodeList = DomNode[] & { item(index: number): DomNode };

class TestTextNode {
  readonly nodeName = '#text';
  readonly nodeType = 3;

  constructor(readonly data: string) {}

  get text() {
    return this.data;
  }
}

class TestElement {
  readonly nodeType = 1;
  readonly childNodes: DomNodeList;

  constructor(readonly nodeName: string, childNodes: DomNode[]) {
    this.childNodes = [...childNodes] as DomNodeList;
    this.childNodes.item = index => this.childNodes[index];
  }

  hasChildNodes() {
    return this.childNodes.length > 0;
  }

  get children(): TestElement[] {
    return this.childNodes.filter(
      (node): node is TestElement => node instanceof TestElement,
    );
  }

  get innerText(): string {
    return this.childNodes
      .map(node => (node instanceof TestElement ? node.innerText : node.data))
      .join('');
  }
}

type CapturedRange = { node: TestTextNode; start: number; end: number };

type TranslationEntry = {
  orig?: string;
  transl?: string;
  primary?: TestElement;
  origSpan?: TestElement;
  translSpan?: TestElement;
};

type TranslationHarness = {
  config?: { enabled: boolean; parallelMode: string };
  entries?: Map<TestElement, TranslationEntry>;
};

type TtsMapping = {
  mapFromElement(element: TestElement): {
    element: TestElement;
    text: string;
    offsets: number[];
    segments: { node: TestTextNode; start: number; end: number }[];
    paragraphId?: string;
  } | null;
  normalizeWithOffsets(raw: string): { text: string; offsets: number[] };
  normalizeText(text: string): string;
  rangesFor(
    map: ReturnType<TtsMapping['mapFromElement']>,
    start: number,
    end: number,
  ): CapturedRange[];
  setWordRange(paragraphId: string, start: number, end: number): void;
  setHighlightSettings(settings: { enabled?: boolean; color?: string }): void;
  collectParagraphTexts(): string[];
  paragraphOriginalText(element: TestElement): string;
  paragraphRoot(element: TestElement): TestElement;
  primaryForMode(
    entry: TranslationEntry,
    parallelMode: string,
  ): TestElement | null;
};

const text = (value: string) => new TestTextNode(value);
const element = (name: string, ...children: DomNode[]) =>
  new TestElement(name.toUpperCase(), children);

// setWordRange reads the map the app installs via setActiveIndex, so reveal
// wordMap here to simulate an active paragraph under test.
type TtsWordMap = NonNullable<ReturnType<TtsMapping['mapFromElement']>>;
type TtsMappingWithWordMap = TtsMapping & { wordMap: TtsWordMap };

const loadTtsMapping = (
  chapterElement: TestElement,
  captured: CapturedRange[],
  translation?: TranslationHarness,
): TtsMapping => {
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

  const highlights = new Map<string, { clear(): void; add(): void }>();

  type TtsContext = {
    reader: {
      chapterElement: TestElement;
      translation?: TranslationHarness;
    };
    window: {
      getComputedStyle(el: TestElement): {
        display: string;
        visibility: string;
      };
      tts?: TtsMapping;
    };
    Node: { TEXT_NODE: number; ELEMENT_NODE: number };
    document: {
      addEventListener(): void;
      createRange(): CapturedRange;
      documentElement: { style: { setProperty(): void } };
    };
    CSS: {
      highlights: {
        get(name: string): { clear(): void; add(): void } | undefined;
        set(name: string, highlight: { clear(): void; add(): void }): void;
        delete(name: string): void;
      };
    };
    Highlight: { new (): { clear(): void; add(): void } };
  };

  const context: TtsContext = {
    reader: { chapterElement, ...(translation ? { translation } : {}) },
    window: {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    },
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    document: {
      addEventListener: () => {},
      createRange: () => {
        const entry: CapturedRange = { node: undefined!, start: 0, end: 0 };
        captured.push(entry);
        return {
          get node() {
            return entry.node;
          },
          get start() {
            return entry.start;
          },
          get end() {
            return entry.end;
          },
          setStart(node: TestTextNode, offset: number) {
            entry.node = node;
            entry.start = offset;
            entry.end = offset;
          },
          setEnd(node: TestTextNode, offset: number) {
            entry.node = node;
            entry.end = offset;
          },
        } as CapturedRange;
      },
      documentElement: { style: { setProperty: () => {} } },
    },
    CSS: {
      highlights: {
        get: name => highlights.get(name),
        set: (name, highlight) => highlights.set(name, highlight),
        delete: name => highlights.delete(name),
      },
    },
    Highlight: class {
      clear() {}
      add() {}
    },
  };

  runInNewContext(core.slice(start, end + closing.length), context);

  if (!context.window || !context.window.tts) {
    throw new Error('Reader TTS implementation did not initialize');
  }

  return context.window.tts;
};

describe('reader TTS word mapping', () => {
  it('produces text identical to normalizeText(innerText) for inline content', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const paragraph = element(
      'span',
      text('Some '),
      element('em', text('italic')),
      text(' text with punctuation: hello, world!'),
    );

    const map = tts.mapFromElement(paragraph);
    expect(map).not.toBeNull();
    expect(map!.text).toBe(tts.normalizeText(paragraph.innerText));
    expect(map!.text).toBe('Some italic text with punctuation: hello, world!');
  });

  it('maps a spoken range back onto the exact text nodes that render it', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const splitA = text('The quick ');
    const splitB = text('brown fox');
    const splitC = text(' jumps over the lazy dog.');
    const paragraph = element(
      'span',
      splitA,
      element('strong', splitB),
      splitC,
    );

    const map = tts.mapFromElement(paragraph);
    expect(map).not.toBeNull();

    const start = map!.text.indexOf('fox');
    const end = start + 'fox'.length;
    const ranges = tts.rangesFor(map, start, end);

    const highlighted = ranges
      .map(range => range.node.data.slice(range.start, range.end))
      .join('');
    expect(highlighted).toBe('fox');
    expect(ranges.length).toBe(1);
    expect(ranges[0].node).toBe(splitB);
  });

  it('rebuilds ranges for a word spanning multiple text nodes', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const splitA = text('Hello ');
    const splitB = text('wor');
    const splitC = text('ld');
    const paragraph = element('span', splitA, splitB, splitC);

    const map = tts.mapFromElement(paragraph);
    const start = map!.text.indexOf('world');
    const end = start + 'world'.length;
    const ranges = tts.rangesFor(map, start, end);

    const highlighted = ranges
      .map(range => range.node.data.slice(range.start, range.end))
      .join('');
    expect(highlighted).toBe('world');
    expect(ranges.map(range => range.node)).toEqual([splitB, splitC]);
  });

  it('tracks offsets through whitespace runs and punctuation spacing', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const paragraph = element('span', text('a  b. c!?'));

    const map = tts.mapFromElement(paragraph);
    expect(map!.text).toBe('a b. c! ?');

    // Each output char maps to a valid raw offset within the flattened text.
    expect(map!.offsets.length).toBe(map!.text.length);
    map!.offsets.forEach((offset, index) => {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(8);
      expect(Number.isInteger(offset)).toBe(true);
      expect(typeof offset).toBe('number');
    });
  });

  it('keeps CJK ranges intact without dropping surrogate pairs', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const sentence = '你好世界 こんにちは';
    const paragraph = element('span', text(sentence));

    const map = tts.mapFromElement(paragraph);
    expect(map!.text).toBe(sentence);

    const start = map!.text.indexOf('世界');
    const end = start + '世界'.length;
    const ranges = tts.rangesFor(map, start, end);
    const highlighted = ranges
      .map(range => range.node.data.slice(range.start, range.end))
      .join('');
    expect(highlighted).toBe('世界');
  });

  it('treats <br> like the paragraph whitespace normalizeText collapses', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const paragraph = element(
      'span',
      text('First line'),
      element('br'),
      text('Second line.'),
    );

    const map = tts.mapFromElement(paragraph);
    expect(map!.text).toBe('First line Second line.');
  });

  it('ignores word ranges that target a different paragraph', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const paragraph = element('span', text('Target paragraph words here.'));
    const map = tts.mapFromElement(paragraph)!;
    (tts as TtsMappingWithWordMap).wordMap = { ...map, paragraphId: '3' };

    tts.setWordRange('2', 0, 6);
    expect(captured).toHaveLength(0);

    tts.setWordRange('3', 0, 6);
    expect(captured.length).toBeGreaterThan(0);
    const highlighted = captured
      .map(range => range.node.data.slice(range.start, range.end))
      .join('');
    expect(highlighted).toBe('Target');
  });

  it('clears the highlight when disabled and ignores ranges while disabled', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const paragraph = element('span', text('Highlight me please.'));
    const map = tts.mapFromElement(paragraph)!;
    (tts as TtsMappingWithWordMap).wordMap = { ...map, paragraphId: '0' };

    tts.setHighlightSettings({ enabled: false });
    tts.setWordRange('0', 0, 9);
    expect(captured).toHaveLength(0);

    tts.setHighlightSettings({ enabled: true, color: '#112233' });
    tts.setWordRange('0', 0, 9);
    expect(captured.length).toBeGreaterThan(0);
  });
});

describe('reader TTS speaks like NoveLA', () => {
  const normalizeText = (raw: string) => {
    const tts = loadTtsMapping(element('div'), []);
    return tts.normalizeText(raw);
  };

  it('strips surrounding straight quotes so the engine never says "quote"', () => {
    expect(normalizeText('"He said."')).toBe('He said.');
    expect(normalizeText('"Alright."')).toBe('Alright.');
  });

  it('strips leading/trailing curly quotes and pseudo-quotes too', () => {
    expect(normalizeText('“Hello.”')).toBe('Hello.');
    expect(normalizeText('‘Hi there.’')).toBe('Hi there.');
  });

  it('keeps quotes in the middle of the paragraph', () => {
    expect(normalizeText('He said "hi" again.')).toBe('He said "hi" again.');
  });

  it('collapses a quote-only paragraph to silence', () => {
    expect(normalizeText('""')).toBe('');
    expect(normalizeText('“”')).toBe('');
  });

  it('strips NoveLA decorative runs and skips decorator-only lines', () => {
    expect(normalizeText('──────')).toBe('');
    expect(normalizeText('***********')).toBe('');
    expect(normalizeText('===== Hello =====')).toBe('Hello');
    expect(
      normalizeText(['First line', '─────', 'Second line.'].join('\n')),
    ).toBe('First line Second line.');
  });

  it('handles quotes around decorated paragraphs', () => {
    expect(normalizeText('─────────"Hello."─────────')).toBe('Hello.');
  });

  it('keeps word mapping aligned with the cleaned spoken text', () => {
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(element('div'), captured);
    const paragraph = element(
      'span',
      text('─────────'),
      text('"Hello'),
      text(' there."'),
      text('─────────'),
    );

    const map = tts.mapFromElement(paragraph);
    expect(map).not.toBeNull();
    expect(map!.text).toBe('Hello there.');
    expect(map!.text).toBe(tts.normalizeText(paragraph.innerText));

    const start = map!.text.indexOf('Hello');
    const end = start + 'Hello'.length;
    const ranges = tts.rangesFor(map, start, end);
    const highlighted = ranges
      .map(range => range.node.data.slice(range.start, range.end))
      .join('');
    expect(highlighted).toBe('Hello');
  });

  it('normalizeWithOffsets stays in exact parity with normalizeText', () => {
    const tts = loadTtsMapping(element('div'), []);
    const corpus = [
      '"He said."',
      '“Hello.”',
      'He said "hi" again.',
      '""',
      '──────',
      '===== Hello =====',
      'First line\n─────\nSecond line.',
      '─────────"Hello."─────────',
      'a  b. c!?',
      '你好世界 こんにちは',
      '   spaced   out   ',
      'Sentence one. Sentence two!',
      '“Quote” and “unfinished',
      '~~*~~ section break ~~*~~',
    ];
    for (const raw of corpus) {
      const { text: spokenText, offsets } = tts.normalizeWithOffsets(raw);
      expect(spokenText).toBe(tts.normalizeText(raw));
      expect(offsets.length).toBe(spokenText.length);
      offsets.forEach((offset, index) => {
        expect(Number.isInteger(offset)).toBe(true);
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThanOrEqual(raw.length);
      });
    }
  });
});

describe('reader TTS translation engine', () => {
  it('collectParagraphTexts lists cleaned originals in DOM order, skipping decorator-only paragraphs', () => {
    const chapter = element(
      'div',
      element('p', text('Hello '), element('strong', text('world'))),
      element('p', text('----------')),
      element('p', text('"Second."')),
    );
    const tts = loadTtsMapping(chapter, []);
    expect(tts.collectParagraphTexts()).toEqual(['Hello world', 'Second.']);
  });

  it('keeps the cleaned original stable through a translation via the stored entry', () => {
    const original = element('p', text('Original text'));
    const chapter = element('div', original);
    const tts = loadTtsMapping(chapter, [], {
      config: { enabled: true, parallelMode: 'PARALLEL_TRANSLATION_FIRST' },
      entries: new Map([
        [
          original,
          { orig: 'Original text', transl: 'Bản gốc', primary: original },
        ],
      ]),
    });
    expect(tts.paragraphOriginalText(original)).toBe('Original text');
    expect(tts.collectParagraphTexts()).toEqual(['Original text']);
    expect(tts.paragraphOriginalText(element('p', text('Unseen')))).toBe(
      'Unseen',
    );
  });

  it('paragraphRoot resolves the node TTS must speak for the active mode', () => {
    const orig = element('span', text('Original'));
    const translated = element('span', text('Bản gốc'));
    const paragraph = element('p', orig, translated);
    const tts = loadTtsMapping(element('div', paragraph), [], {
      config: { enabled: true, parallelMode: 'PARALLEL_TRANSLATION_FIRST' },
      entries: new Map([
        [
          paragraph,
          {
            orig: 'Original',
            transl: 'Bản gốc',
            primary: translated,
            origSpan: orig,
            translSpan: translated,
          },
        ],
      ]),
    });
    expect(tts.paragraphRoot(paragraph)).toBe(translated);
    const untranslated = element('p', text('Untranslated'));
    expect(tts.paragraphRoot(untranslated)).toBe(untranslated);
  });

  it('primaryForMode picks the spoken side, falling back to the original for empty translations', () => {
    const orig = element('span', text('Original'));
    const translated = element('span', text('Bản gốc'));
    const tts = loadTtsMapping(element('div'), []);
    expect(
      tts.primaryForMode(
        { origSpan: orig, translSpan: translated },
        'ORIGINAL_ONLY',
      ),
    ).toBe(orig);
    expect(
      tts.primaryForMode(
        { origSpan: orig, translSpan: translated },
        'PARALLEL_ORIGINAL_FIRST',
      ),
    ).toBe(orig);
    expect(
      tts.primaryForMode(
        { origSpan: orig, translSpan: translated },
        'PARALLEL_TRANSLATION_FIRST',
      ),
    ).toBe(translated);
    expect(
      tts.primaryForMode(
        { origSpan: orig, translSpan: translated },
        'TRANSLATED_ONLY',
      ),
    ).toBe(translated);
    expect(
      tts.primaryForMode(
        { origSpan: orig, translSpan: undefined },
        'TRANSLATED_ONLY',
      ),
    ).toBe(orig);
  });

  it('keeps the spoken text in parity with the primary side highlight map', () => {
    const orig = element(
      'span',
      text('Hello '),
      element('strong', text('world')),
    );
    const translated = element('span', text('Xin chào thế giới'));
    const paragraph = element('p', orig, translated);
    const chapter = element('div', paragraph);
    const captured: CapturedRange[] = [];
    const tts = loadTtsMapping(chapter, captured, {
      config: { enabled: true, parallelMode: 'TRANSLATED_ONLY' },
      entries: new Map([
        [
          paragraph,
          {
            orig: 'Hello world',
            transl: 'Xin chào thế giới',
            primary: translated,
            origSpan: orig,
            translSpan: translated,
          },
        ],
      ]),
    });

    const root = tts.paragraphRoot(paragraph);
    expect(root).toBe(translated);
    const map = tts.mapFromElement(root);
    expect(map).not.toBeNull();
    expect(map!.text).toBe(tts.normalizeText(translated.innerText));
    expect(map!.text).toBe('Xin chào thế giới');

    const start = map!.text.indexOf('chào');
    const end = start + 'chào'.length;
    const ranges = tts.rangesFor(map, start, end);
    const highlighted = ranges
      .map(range => range.node.data.slice(range.start, range.end))
      .join('');
    expect(highlighted).toBe('chào');
    expect(captured.length).toBeGreaterThan(0);
  });
});
