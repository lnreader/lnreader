import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { MYANIMELIST_CLIENT_ID } from '@env';
import {
  AuthenticationResult,
  Tracker,
  UserListEntry,
  UserListStatus,
} from './index';

const clientId = MYANIMELIST_CLIENT_ID;
const baseOAuthUrl = 'https://myanimelist.net/v1/oauth2/authorize';
const tokenUrl = 'https://myanimelist.net/v1/oauth2/token';
const baseApiUrl = 'https://api.myanimelist.net/v2';
const challenge = pkceChallenger();
const authUrl = `${baseOAuthUrl}?response_type=code&client_id=${clientId}&code_challenge_method=plain&code_challenge=${challenge}`;
const redirectUri = Linking.createURL('tracker/MAL');

export const malToNormalized: Record<string, UserListStatus> = {
  reading: 'CURRENT',
  completed: 'COMPLETED',
  on_hold: 'PAUSED',
  dropped: 'DROPPED',
  plan_to_read: 'PLANNING',
};
const normalizedToMal: Record<UserListStatus, string> = {
  CURRENT: 'reading',
  COMPLETED: 'completed',
  PAUSED: 'on_hold',
  DROPPED: 'dropped',
  PLANNING: 'plan_to_read',
  REPEATING: 'reading;true', // MAL has a bool for repeating, so we'll special case this
};

export const myAnimeListTracker: Tracker = {
  authenticate: async () => {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type !== 'success') {
      throw 'Failed to authenticate with MyAnimeList';
    }

    const { url } = result;

    const codeExtractor = new RegExp(/[=]([^&]+)/);
    const codeMatch = url.match(codeExtractor);

    if (!codeMatch) {
      throw 'Failed to extract authorization code from URL';
    }

    const code = codeMatch[1];
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }, // @ts-expect-error - If no clientId is set, which will only be set in production builds, this will error out.
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        code_verifier: challenge,
      }).toString(),
    });

    const tokenResponse = await response.json();
    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in),
    };
  },
  revalidate: async auth => {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken!,
      }).toString(),
    });

    const tokenResponse = await response.json();
    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in),
    };
  },
  handleSearch: async (search, auth) => {
    const searchUrl = `${baseApiUrl}/manga?q=${search}&fields=id,title,main_picture,media_type`;
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    });

    if (response.status !== 200) {
      return [];
    }

    const { data } = await response.json();
    return data
      .filter((e: any) => e.node.media_type === 'light_novel')
      .map((e: any) => {
        return {
          id: e.node.id,
          title: e.node.title,
          coverImage: e.node.main_picture.large,
        };
      });
  },
  getUserListEntry: async (id, auth) => {
    const url = `${baseApiUrl}/manga/${id}?fields=id,num_chapters,my_list_status{start_date,finish_date}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    if (!data.my_list_status) {
      const newListEntry = await updateMyAnimeListEntry(
        id,
        { status: 'CURRENT', progress: 0, score: 0 },
        auth,
      );
      return {
        ...newListEntry,
        totalChapters: data.num_chapters,
      };
    }

    return {
      status: malToNormalized[data.my_list_status.status] || 'CURRENT',
      score: data.my_list_status.score || 0,
      progress: data.my_list_status.num_chapters_read || 0,
      totalChapters: data.num_chapters,
    };
  },
  updateUserListEntry: updateMyAnimeListEntry,
};

async function updateMyAnimeListEntry(
  id: number | string,
  payload: Partial<UserListEntry>,
  auth: AuthenticationResult,
) {
  let status = payload.status
    ? normalizedToMal[payload.status]
    : normalizedToMal.CURRENT;
  let repeating = 'false';
  if (status.includes(';')) {
    const split = status.split(';');
    status = split[0];
    repeating = split[1];
  }

  const url = `${baseApiUrl}/manga/${id}/my_list_status`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      status,
      is_rereading: repeating,
      num_chapters_read: String(payload.progress ?? 0),
      score: String(payload.score ?? 0),
    }).toString(),
  });

  const data = await res.json();

  let normalizedStatus = malToNormalized[data.status];
  if (!normalizedStatus && data.is_rereading) {
    normalizedStatus = 'REPEATING';
  }

  return {
    status: normalizedStatus || payload.status || 'CURRENT',
    progress: data.num_chapters_read ?? payload.progress ?? 0,
    score: data.score ?? payload.score ?? 0,
  };
}

function pkceChallenger() {
  const MAX_LENGTH = 88;
  let code = '';

  const codes =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const randomPicker = () => Math.floor(Math.random() * codes.length);

  for (let index = 0; index < MAX_LENGTH; index++) {
    code += codes.charAt(randomPicker());
  }
  return code;
}
