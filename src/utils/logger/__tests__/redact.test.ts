import { setMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';
import { redact } from '../redact';

describe('redact', () => {
  beforeEach(() => {
    MMKVStorage.clearAll();
  });

  it('leaves ordinary text untouched', () => {
    const text = 'Failed to fetch chapter 12: request timed out after 30s';
    expect(redact(text)).toBe(text);
  });

  it('redacts a Bearer token', () => {
    const text = 'Authorization: Bearer abc123.def456-ghi789';
    expect(redact(text)).toBe('Authorization: <redacted>');
  });

  it('redacts an access_token in query-string form', () => {
    const text =
      'GET https://anilist.co/callback?access_token=SUPERSECRET&state=xyz';
    const result = redact(text);
    expect(result).not.toContain('SUPERSECRET');
    expect(result).toContain('access_token=<redacted>');
    expect(result).toContain('state=xyz');
  });

  it('redacts an accessToken in JSON form', () => {
    const text = JSON.stringify({ accessToken: 'SUPERSECRET', userId: 42 });
    const result = redact(text);
    expect(result).not.toContain('SUPERSECRET');
    expect(result).toContain('"accessToken":"<redacted>"');
    expect(result).toContain('"userId":42');
  });

  it('redacts a Cookie header line without touching the rest of the log', () => {
    const text = [
      'Requesting novel page',
      'Cookie: session=abc123; csrf=def456',
      'Response: 200 OK',
    ].join('\n');
    const result = redact(text);
    expect(result).toContain('Cookie: <redacted>');
    expect(result).not.toContain('session=abc123');
    expect(result).toContain('Requesting novel page');
    expect(result).toContain('Response: 200 OK');
  });

  it('scrubs a live tracker token planted in MMKV even without a recognizable key=value shape', () => {
    const token = 'live-anilist-token-9f8e7d';
    setMMKVObject('TRACKERS', {
      AniList: {
        name: 'AniList',
        auth: { accessToken: token, expiresAt: new Date().toISOString() },
      },
    });

    const text = `Sync failed for token ${token} while updating list entry`;
    const result = redact(text);
    expect(result).not.toContain(token);
    expect(result).toContain('<redacted>');
  });
});
