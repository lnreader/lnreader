import {
  composeCSS,
  composeJS,
  safeApplyRegex,
  applyTextModifications,
  CodeSnippet,
} from '../customCode';

describe('composeCSS', () => {
  it('returns empty string for empty array', () => {
    expect(composeCSS([])).toBe('');
  });

  it('returns empty string when all snippets are inactive', () => {
    const snippets: CodeSnippet[] = [
      { name: 'a', code: 'body { color: red; }', lang: 'css', active: false },
      { name: 'b', code: 'h1 { font-size: 2em; }', lang: 'css', active: false },
    ];
    expect(composeCSS(snippets)).toBe('');
  });

  it('concatenates only active snippet code, joined by newline', () => {
    const snippets: CodeSnippet[] = [
      { name: 'a', code: 'body { color: red; }', lang: 'css', active: true },
      { name: 'b', code: 'h1 { font-size: 2em; }', lang: 'css', active: false },
      { name: 'c', code: 'p { margin: 0; }', lang: 'css', active: true },
    ];
    expect(composeCSS(snippets)).toBe('body { color: red; }\np { margin: 0; }');
  });

  it('preserves order', () => {
    const snippets: CodeSnippet[] = [
      { name: 'a', code: 'first', lang: 'css', active: true },
      { name: 'b', code: 'second', lang: 'css', active: true },
      { name: 'c', code: 'third', lang: 'css', active: true },
    ];
    expect(composeCSS(snippets)).toBe('first\nsecond\nthird');
  });
});

describe('composeJS', () => {
  it('returns empty string for empty array', () => {
    expect(composeJS([])).toBe('');
  });

  it('returns empty string when all snippets are inactive', () => {
    const snippets: CodeSnippet[] = [
      { name: 'a', code: 'console.log(1)', lang: 'js', active: false },
      { name: 'b', code: 'console.log(2)', lang: 'js', active: false },
    ];
    expect(composeJS(snippets)).toBe('');
  });

  it('each active snippet wrapped in try/catch with JSON-stringified name', () => {
    const snippets: CodeSnippet[] = [
      { name: 'test-snippet', code: 'doSomething()', lang: 'js', active: true },
    ];
    const result = composeJS(snippets);
    expect(result).toContain('try {');
    expect(result).toContain('doSomething()');
    expect(result).toContain('} catch (error) {');
    expect(result).toContain(`${JSON.stringify('test-snippet')}`);
  });

  it('multiple active snippets produce concatenated try/catch blocks', () => {
    const snippets: CodeSnippet[] = [
      { name: 'a', code: 'fnA()', lang: 'js', active: true },
      { name: 'b', code: 'fnB()', lang: 'js', active: true },
    ];
    const result = composeJS(snippets);
    expect(result).toContain('fnA()');
    expect(result).toContain('fnB()');
    const matches = result.match(/try\s*\{/g);
    expect(matches).toHaveLength(2);
  });
});

describe('safeApplyRegex', () => {
  it('applies valid regex with replacement and returns modified text', () => {
    const match = ['/foo/g', 'foo', 'g'] as unknown as RegExpMatchArray;
    const result = safeApplyRegex(match, 'foo bar foo', 'baz');
    expect(result).toBe('baz bar baz');
  });

  it('applies valid regex without replacement (default empty string) — removes matches', () => {
    const match = ['/\\d+/g', '\\d+', 'g'] as unknown as RegExpMatchArray;
    const result = safeApplyRegex(match, 'abc 123 def 456');
    expect(result).toBe('abc  def ');
  });

  it('returns original text when flags are invalid — does not throw', () => {
    const match = ['/foo/x', 'foo', 'x'] as unknown as RegExpMatchArray;
    const result = safeApplyRegex(match, 'foo bar', 'baz');
    expect(result).toBe('foo bar');
  });

  it('returns original text when regex pattern itself is invalid', () => {
    const match = [
      '/(unmatched(/g',
      '(unmatched(',
      'g',
    ] as unknown as RegExpMatchArray;
    const result = safeApplyRegex(match, 'test', 'replacement');
    expect(result).toBe('test');
  });

  it('handles all valid flags: g, m, i, y, u, v, s, d', () => {
    const text = 'Line1\nline2\nLINE3\nline4';
    const match = [
      '/^line.*/gim',
      '^line.*',
      'gim',
    ] as unknown as RegExpMatchArray;
    const result = safeApplyRegex(match, text, 'MATCH');
    expect(result).toBe('MATCH\nMATCH\nMATCH\nMATCH');
  });

  it('uses RegExp match array format ["/pattern/flags", "pattern", "flags"]', () => {
    const text = 'hello world hello';
    const match = ['/hello/g', 'hello', 'g'] as unknown as RegExpMatchArray;
    const result = safeApplyRegex(match, text, 'hi');
    expect(result).toBe('hi world hi');
  });
});

describe('applyTextModifications', () => {
  it('removes literal text strings via removeText array (split/join)', () => {
    const result = applyTextModifications('hello world foo', ['world '], {});
    expect(result).toBe('hello foo');
  });

  it('removes text matching regex patterns from removeText (entries starting/ending with /)', () => {
    const result = applyTextModifications('abc123def456ghi', ['/\\d+/g'], {});
    expect(result).toBe('abcdefghi');
  });

  it('replaces literal text strings via replaceText record', () => {
    const result = applyTextModifications('hello world', [], { hello: 'hi' });
    expect(result).toBe('hi world');
  });

  it('replaces text matching regex patterns from replaceText keys', () => {
    const result = applyTextModifications('foo123bar456baz', [], {
      '/\\d+/g': '#',
    });
    expect(result).toBe('foo#bar#baz');
  });

  it('apply order: removeText first, then replaceText', () => {
    const result = applyTextModifications('x hello x world x', ['x '], {
      world: 'earth',
    });
    expect(result).toBe('hello earth x');
  });

  it('empty text key in replaceText is skipped', () => {
    const result = applyTextModifications('hello world', [], {
      '': 'x',
      hello: 'hi',
    });
    expect(result).toBe('hi world');
  });

  it('returns html unchanged when both arrays are empty', () => {
    const result = applyTextModifications('original text', [], {});
    expect(result).toBe('original text');
  });

  it('regex in removeText and literal in replaceText coexist correctly', () => {
    const result = applyTextModifications('abc123def', ['/\\d+/g'], {
      def: 'xyz',
    });
    expect(result).toBe('abcxyz');
  });
});
