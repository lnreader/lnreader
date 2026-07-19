import { myAnimeListTracker } from '../myAnimeList';

jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'lnreader://tracker/MAL'),
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

const auth = {
  accessToken: 'access-token',
  expiresAt: new Date(),
};

describe('MyAnimeList tracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a default list entry when the manga is not tracked yet', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ id: 123, num_chapters: 10 }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          status: 'reading',
          num_chapters_read: 0,
          score: 0,
        }),
      } as unknown as Response);

    await expect(
      myAnimeListTracker.getUserListEntry(123, auth),
    ).resolves.toEqual({
      status: 'CURRENT',
      progress: 0,
      score: 0,
      totalChapters: 10,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.myanimelist.net/v2/manga/123/my_list_status',
      expect.objectContaining({
        method: 'PUT',
        body: 'status=reading&is_rereading=false&num_chapters_read=0&score=0',
      }),
    );
  });

  it('returns an existing list entry without updating it', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: jest.fn().mockResolvedValue({
        num_chapters: 10,
        my_list_status: {
          status: 'plan_to_read',
          num_chapters_read: 0,
          score: 0,
        },
      }),
    } as unknown as Response);

    await expect(
      myAnimeListTracker.getUserListEntry(123, auth),
    ).resolves.toEqual({
      status: 'PLANNING',
      progress: 0,
      score: 0,
      totalChapters: 10,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
