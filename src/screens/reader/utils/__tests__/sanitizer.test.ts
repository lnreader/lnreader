import { sanitizeChapter } from '../sanitizer';

describe('LNReader App Chapter Sanitizer', () => {
  it('strips elements with display:none and honeypot classes', () => {
    const rawHtml = `
      <div>
        <p>Visible sentence 1.</p>
        <p style="display: none;">Invisible honey-pot trap text!</p>
        <div style="font-size: 0px;">Another stealth bot detector</div>
        <p class="tts-trap">Decoy paragraph for scrapers</p>
        <p>Visible sentence 2.</p>
      </div>
    `;

    const result = sanitizeChapter(rawHtml);

    expect(result.cleanHtml).toContain('Visible sentence 1.');
    expect(result.cleanHtml).toContain('Visible sentence 2.');
    expect(result.cleanHtml).not.toContain('Invisible honey-pot trap text!');
    expect(result.cleanHtml).not.toContain('Another stealth bot detector');
    expect(result.cleanHtml).not.toContain('Decoy paragraph for scrapers');
  });

  it('unwraps fragmented spans and removes zero-width characters for smooth TTS', () => {
    const rawHtml = `
      <p><span>T\u200Bh\u200Be</span> <span>spell</span> <span>h\uFEFFas</span> <span>begun.</span></p>
    `;

    const result = sanitizeChapter(rawHtml);

    expect(result.cleanHtml).not.toContain('<span>');
    expect(result.cleanHtml).not.toContain('\u200B');
    expect(result.cleanHtml).not.toContain('\uFEFF');
    expect(result.cleanText).toBe('The spell has begun.');
  });

  it('removes adjacent cloned paragraphs (fixes TTS double-reading trap)', () => {
    const rawHtml = `
      <div id="content">
        <p>Sunny crept cautiously through the dark obsidian corridor.</p>
        <p>Sunny crept cautiously through the dark obsidian corridor.</p>
        <p>He listened for the faintest breathing of the nightmare creature.</p>
      </div>
    `;

    const result = sanitizeChapter(rawHtml);

    const matches = (result.cleanHtml.match(/Sunny crept cautiously/g) || []).length;
    expect(matches).toBe(1);
    expect(result.cleanHtml).toContain('nightmare creature');
  });

  it('flags anomaly when high levels of filler text or extreme duplicates occur', () => {
    const rawHtml = `
      <div>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      </div>
    `;

    const result = sanitizeChapter(rawHtml);
    expect(result.isClean).toBe(false);
    expect(result.anomalyReport.isAnomaly).toBe(true);
    expect(
      result.anomalyReport.reasons.some((r: string) => r.includes('Lorem ipsum'))
    ).toBe(true);
  });
});
