import { readerFonts } from '@utils/constants/readerConstants';

import { fontFaceCss, fontFamilyValue } from '../fonts';
import { DEFAULT_READER_PREFERENCES } from '../preferences';
import { buildReaderStyles } from '../styles';

const build = (values = {}) =>
  buildReaderStyles(
    { ...DEFAULT_READER_PREFERENCES, ...values },
    'file:///android_asset',
  );

describe('fonts', () => {
  it('declares every bundled reader font from its file', () => {
    for (const { fontFamily } of readerFonts.filter(font => font.fontFamily)) {
      expect(fontFamilyValue(fontFamily)).toBe(`"${fontFamily}"`);
      expect(fontFaceCss(fontFamily, 'file:///android_asset')).toContain(
        `url("file:///android_asset/fonts/${fontFamily}.ttf")`,
      );
    }
  });

  it('keeps the chapter fonts for the original family', () => {
    expect(fontFamilyValue('')).toBeUndefined();
    expect(fontFaceCss('', 'x')).toBe('');
  });

  it('rejects names that could break out of the rule', () => {
    expect(fontFamilyValue('a"; } body { display: none')).toBeUndefined();
  });
});

describe('buildReaderStyles', () => {
  it('puts defaults before the chapter styles and choices after them', () => {
    const { before, after } = build({ fontFamily: 'lora' });
    expect(before).toContain('@font-face');
    expect(before).toContain('max-width: 100%');
    expect(after).toContain('font-size: 16px !important');
    expect(after).toContain('font-family: "lora";');
  });

  it('moves custom @import rules to the start of the styles', () => {
    const css =
      "@import url('https://fonts.googleapis.com/css2?family=Tsukimi+Rounded&display=swap');\n" +
      "body { font-family: 'Tsukimi Rounded'; }";
    const { before, after } = build({ customCss: css });
    expect(before.trimStart().startsWith('@import url(')).toBe(true);
    expect(after).not.toContain('@import');
    expect(after).toContain("font-family: 'Tsukimi Rounded'");
  });

  it('lets custom CSS set the font on body', () => {
    const { after } = build({
      fontFamily: 'lora',
      customCss: 'body { font-family: serif; }',
    });
    expect(after).not.toContain('font-family: "lora" !important');
    expect(after.indexOf('font-family: serif')).toBeGreaterThan(
      after.indexOf('font-family: "lora"'),
    );
  });

  it('keeps chapter fonts for the original family', () => {
    const { before, after } = build({ fontFamily: '' });
    expect(before).not.toContain('@font-face');
    expect(after).not.toContain('font-family: inherit');
  });

  it('reflects spacing, indent and alignment', () => {
    const { after } = build({
      paragraphSpacing: 1.25,
      textIndent: 2,
      textAlign: 'justify',
    });
    expect(after).toContain('margin: 0 0 1.25em 0 !important');
    expect(after).toContain('text-indent: 2em !important');
    expect(after).toContain('text-align: justify !important');
  });

  it('pads chapters in scrolled mode only', () => {
    expect(build({ flow: 'scrolled' }).after).toContain('padding: 24px 0 40px');
    expect(build({ flow: 'paginated' }).after).not.toContain('padding: 24px 0');
  });

  it('shows the chapter ending only when scrolling one chapter at a time', () => {
    const hidden = '.ln-chapter-end { display: none !important; }';
    expect(
      build({ flow: 'scrolled', continuousChapters: false }).after,
    ).not.toContain(hidden);
    expect(
      build({ flow: 'scrolled', continuousChapters: true }).after,
    ).toContain(hidden);
    expect(build({ flow: 'paginated' }).after).toContain(hidden);
  });

  it('colours links and selections with the app theme', () => {
    const { after } = build({
      cssVariables: {
        'theme-primary': '#123456',
        'theme-secondary': '#654321',
      },
    });
    expect(after).toContain('body a { color: #123456 !important; }');
    expect(after).toContain('::selection { background: #654321;');
  });

  it('hands the page colour to the paginator, over the chapter’s own', () => {
    const { after } = build({ backgroundColor: '#111111' });
    expect(after).toContain('--theme-bg-color: #111111');
    expect(after).toContain('--override-color: true');
    // A colour scheme differing from the reader page makes Chromium paint the
    // chapter frame opaque, hiding the running head.
    expect(after).not.toContain('color-scheme');
  });

  it('rejects colours that would break out of the declaration', () => {
    const { after } = build({ textColor: 'red; } body { display: none' });
    expect(after).not.toContain('} body { display: none');
    expect(after).toContain(
      `color: ${DEFAULT_READER_PREFERENCES.textColor} !important`,
    );
  });

  it('appends custom CSS last', () => {
    const { after } = build({ customCss: '.mine { color: pink }' });
    expect(after.trim().endsWith('.mine { color: pink }')).toBe(true);
  });

  it('hides blank lines when extra paragraph spacing is removed', () => {
    expect(build({ removeExtraParagraphSpacing: true }).after).toContain(
      'br + br',
    );
    expect(build().after).not.toContain('br + br');
  });
});
