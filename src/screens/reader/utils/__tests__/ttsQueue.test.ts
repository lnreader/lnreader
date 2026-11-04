import { buildTtsQueueFromHtml, normalizeTtsText } from '../ttsQueue';

describe('background TTS queue', () => {
  it('preserves paragraph order without duplicating inline markup', () => {
    expect(
      buildTtsQueueFromHtml(
        '<section><p>First <em>paragraph</em></p><p><span>Second</span></p></section>',
      ),
    ).toEqual(['First paragraph', 'Second']);
  });

  it('preserves intentionally repeated paragraphs', () => {
    expect(buildTtsQueueFromHtml('<p>Same</p><p>Same</p>')).toEqual([
      'Same',
      'Same',
    ]);
  });

  it('drops divider-only paragraphs', () => {
    expect(
      buildTtsQueueFromHtml('<p>Before</p><p>———</p><p>After</p>'),
    ).toEqual(['Before', 'After']);
  });

  it('normalizes whitespace and surrounding quotes', () => {
    expect(normalizeTtsText('  “Hello   world.” ')).toBe('Hello world.');
  });

  it('preserves word boundaries across line breaks', () => {
    expect(
      buildTtsQueueFromHtml('<p>Hello<br>world</p><p>One<br><br>more line</p>'),
    ).toEqual(['Hello world', 'One more line']);
  });
});
