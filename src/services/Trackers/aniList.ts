import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ANILIST_CLIENT_ID } from '@env';
import { AuthenticationResult, Tracker } from './index';

const apiEndpoint = 'https://graphql.anilist.co';
const clientId = ANILIST_CLIENT_ID;

const redirectUri = Linking.createURL('tracker/AL');

const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&response_type=token`;

const searchQuery = `query($search: String) {
  Page {
    media(search: $search, type: MANGA, format: NOVEL, sort: POPULARITY_DESC) {
      id
      chapters
      title {
        userPreferred
      }
      coverImage {
        extraLarge
      }
    }
  }
}`;
const getListEntryQuery = `query($userId: Int!, $mediaId: Int!) {
  MediaList(userId: $userId, mediaId: $mediaId) {
    id
    status
    progress
    score
    media {
      chapters
    }
  }
}`;
const updateListEntryMutation = `mutation($id: Int!, $status: MediaListStatus, $progress: Int, $score: Float) {
  SaveMediaListEntry(mediaId: $id, status: $status, progress: $progress, score: $score) {
    id
    status
    progress
    score
  }
}`;

export const aniListTracker = {
  authenticate: async () => {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type === 'success') {
      const { url } = result;

      const keyVal: Record<string, string> = {};
      url
        .split('#')[1]
        .split('&')
        .forEach(k => {
          const split = k.split('=');
          keyVal[split[0]] = split[1];
        });
      const accessToken = keyVal.access_token;
      // The expiration date is provided in seconds, so we convert to milliseconds to construct a date
      const expiresAt = new Date(Number(keyVal.expires_at) * 1000);

      const { data } = await queryAniList(
        '{ Viewer { id mediaListOptions { scoreFormat } } }',
        {},
        { accessToken },
      );

      return {
        accessToken,
        // AniList does not support refresh tokens.
        refreshToken: undefined,
        expiresAt,
        meta: {
          // Updating list entries requires the user ID
          userId: data.Viewer.id,
          // AniList supports multiple user-facing score formats (numbers, stars, smilies)
          scoreFormat: data.Viewer.mediaListOptions.scoreFormat,
        },
      };
    }
  },
  // AniList does not support refresh tokens, so we can't re-authenticate the user.
  revalidate: undefined,
  handleSearch: async (search, auth) => {
    const { data } = await queryAniList(searchQuery, { search }, auth);

    return data.Page.media.map((m: any) => {
      return {
        id: m.id,
        title: m.title.userPreferred,
        coverImage: m.coverImage.extraLarge,
        totalChapters: m.chapters || undefined,
      };
    });
  },
  getUserListEntry: async (id, auth) => {
    const { data } = await queryAniList(
      getListEntryQuery,
      { userId: auth.meta!.userId, mediaId: id },
      auth,
    );

    return {
      status: data.MediaList?.status || 'CURRENT',
      progress: data.MediaList?.progress || 0,
      score: data.MediaList?.score || 0,
      totalChapters: data.MediaList?.media.chapters || null,
    };
  },
  updateUserListEntry: async (id, payload, auth) => {
    const { data } = await queryAniList(
      updateListEntryMutation,
      {
        id,
        status: payload.status,
        progress: Math.round(payload.progress || 1),
        score: payload.score,
      },
      auth,
    );

    return {
      status: data.SaveMediaListEntry?.status || 'CURRENT',
      progress: data.SaveMediaListEntry?.progress || 0,
      score: data.SaveMediaListEntry?.score || 0,
    };
  },
} as Tracker<{ userId: number; scoreFormat: string }>;

export async function queryAniList(
  query: string,
  variables: any,
  auth: Pick<AuthenticationResult, 'accessToken'>,
) {
  const res = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  return res.json();
}
