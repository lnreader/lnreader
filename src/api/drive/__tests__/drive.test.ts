import { escapeQueryValue, findFiles, getBackups } from '../index';
import { DriveRequestError, list } from '../request';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    getTokens: jest.fn().mockResolvedValue({ accessToken: 'token' }),
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    json: () => Promise.resolve(body),
  } as Response);

const folder = (id: string, name: string, createdTime: string) => ({
  id,
  name,
  createdTime,
  kind: 'drive#file',
  parents: [],
});

const queryOf = (callIndex: number) =>
  new URL(mockFetch.mock.calls[callIndex][0]).searchParams.get('q') ?? '';

describe('Google Drive API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('escapes quotes and backslashes in query values', () => {
    expect(escapeQueryValue("Bob's \\ backup")).toBe("Bob\\'s \\\\ backup");
  });

  it('throws the Drive error message instead of returning an empty list', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Insufficient permission' } }, 403),
    );

    const request = list({ q: "name = 'x'" });

    await expect(request).rejects.toBeInstanceOf(DriveRequestError);
    await expect(request).rejects.toThrow(
      'Google Drive request failed (403): Insufficient permission',
    );
  });

  it('follows page tokens as request parameters', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          files: [folder('1', 'data.zip', '2026-01-02')],
          nextPageToken: 'next',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ files: [folder('2', 'data.zip', '2026-01-01')] }),
      );

    const files = await findFiles('data.zip', false, 'parent');

    expect(files.map(file => file.id)).toEqual(['1', '2']);
    const secondUrl = new URL(mockFetch.mock.calls[1][0]);
    expect(secondUrl.searchParams.get('pageToken')).toBe('next');
    expect(secondUrl.searchParams.get('q')).not.toContain('pageToken');
  });

  it('lists backups from every LNReader root without a full-text marker', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          files: [
            folder('root-a', 'LNReader', '2025-01-01'),
            folder('root-b', 'LNReader', '2025-06-01'),
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          files: [
            folder('old', 'Phone.backup', '2025-02-01'),
            folder('other', 'Not a backup', '2025-03-01'),
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ files: [folder('new', "Bob's.backup", '2025-07-01')] }),
      );

    const backups = await getBackups();

    expect(backups.map(backup => backup.id)).toEqual(['new', 'old']);
    for (let i = 0; i < mockFetch.mock.calls.length; i++) {
      expect(queryOf(i)).not.toContain('fullText');
    }
    expect(queryOf(1)).toContain("'root-a' in parents");
    expect(queryOf(2)).toContain("'root-b' in parents");
  });
});
