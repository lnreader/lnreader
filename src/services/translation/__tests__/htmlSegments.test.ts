import { segmentHtml } from '../htmlSegments';

describe('segmentHtml', () => {
  it('extracts text runs in document order', () => {
    const { segments } = segmentHtml(
      '<div><p>First line</p><p>Second line</p></div>',
    );
    expect(segments).toEqual(['First line', 'Second line']);
  });

  it('ignores whitespace-only nodes', () => {
    const { segments } = segmentHtml('<div>\n  <p>Only this</p>\n</div>');
    expect(segments).toEqual(['Only this']);
  });

  it('never sends script or style contents to a provider', () => {
    const { segments } = segmentHtml(
      '<div><script>var x = "leak";</script><style>.a{color:red}</style><p>Body</p></div>',
    );
    expect(segments).toEqual(['Body']);
  });

  it('writes translations back into the document', () => {
    const { segments, rebuild } = segmentHtml('<p>Hello</p><p>World</p>');
    expect(segments).toEqual(['Hello', 'World']);

    const html = rebuild(['Bonjour', 'Monde']);
    expect(html).toContain('Bonjour');
    expect(html).toContain('Monde');
    expect(html).not.toContain('Hello');
  });

  it('preserves markup and image sources through a round trip', () => {
    const { rebuild } = segmentHtml(
      '<div class="chapter"><img src="file:///novels/1/0.b64.png"><p>Text</p></div>',
    );
    const html = rebuild(['Texte']);

    expect(html).toContain('src="file:///novels/1/0.b64.png"');
    expect(html).toContain('class="chapter"');
    expect(html).toContain('Texte');
  });

  it('leaves untranslated segments in the source language', () => {
    // The resilience contract: a failed chunk must not blank out its text.
    const { rebuild } = segmentHtml('<p>One</p><p>Two</p><p>Three</p>');
    const html = rebuild(['Uno', undefined, 'Tres']);

    expect(html).toContain('Uno');
    expect(html).toContain('Two');
    expect(html).toContain('Tres');
  });

  it('treats an empty translation as a failure rather than blanking text', () => {
    const { rebuild } = segmentHtml('<p>Keep me</p>');
    expect(rebuild([''])).toContain('Keep me');
  });

  it('preserves whitespace surrounding a text node', () => {
    const { segments, rebuild } = segmentHtml('<p>  Spaced  </p>');
    expect(segments).toEqual(['Spaced']);
    expect(rebuild(['Espacé'])).toContain('  Espacé  ');
  });

  it('reports no segments for markup with no text', () => {
    expect(segmentHtml('<div><img src="a.png"></div>').segments).toEqual([]);
  });
});
