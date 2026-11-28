import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  DriveCreateRequestData,
  DriveFile,
  DriveReponse,
  DriveRequestParams,
} from './types';
import { PATH_SEPARATOR } from '@api/constants';
import NativeZipArchive from '@modules/native-zip-archive';

const BASE_URL = 'https://www.googleapis.com/drive/v3/files';
const MEDIA_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_FIELDS = 'id, name, description, createdTime, parents';

export class DriveRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'DriveRequestError';
  }
}

const buildParams = (params: DriveRequestParams) => {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(pair => pair.map(v => encodeURIComponent(String(v))).join('='))
    .join('&');
};

const getAuthHeaders = async () => {
  const { accessToken } = await GoogleSignin.getTokens();
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
};

// Drive reports failures as a non-2xx status with a `{ error: { message } }`
// body. Reading that as a success used to surface as an empty backup list.
const parseResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.error?.message || detail;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new DriveRequestError(
      `Google Drive request failed (${res.status}): ${detail}`,
      res.status,
    );
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
};

export const list = async (
  params: DriveRequestParams,
): Promise<DriveReponse> => {
  const headers = await getAuthHeaders();
  const url =
    BASE_URL +
    '?' +
    buildParams({
      fields: `nextPageToken, files(${FILE_FIELDS})`,
      ...params,
    });
  const res = await parseResponse<DriveReponse>(await fetch(url, { headers }));
  return { ...res, files: res.files ?? [] };
};

export const create = async (
  data: DriveCreateRequestData,
): Promise<DriveFile> => {
  const headers = await getAuthHeaders();

  const params: DriveRequestParams = {
    fields: FILE_FIELDS,
    uploadType: 'multipart',
  };
  const url =
    (data.content ? MEDIA_UPLOAD_URL : BASE_URL) + '?' + buildParams(params);
  let body: any;
  const contentHeaders: Record<string, string> = {};
  data.metadata.name = data.metadata.name.replace(/\//g, PATH_SEPARATOR);
  if (data.content) {
    body = new FormData();
    body.append('metadata', {
      string: JSON.stringify(data.metadata),
      type: 'application/json',
    });
    if (data.metadata.mimeType === 'application/json') {
      body.append('media', {
        string: data.content,
        type: data.metadata.mimeType,
      });
    } else {
      body.append('media', {
        name: data.metadata.name,
        uri: data.content,
        type: data.metadata.mimeType,
      });
    }
  } else {
    body = JSON.stringify(data.metadata);
    contentHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, ...contentHeaders },
    body,
  });
  return parseResponse<DriveFile>(res);
};

export const updateMetadata = async (
  fileId: string,
  fileMetaData: Partial<DriveFile>,
  oldParent?: string,
): Promise<DriveFile> => {
  const headers = await getAuthHeaders();
  const url =
    BASE_URL +
    '/' +
    fileId +
    '?' +
    buildParams({
      fields: FILE_FIELDS,
      addParents: fileMetaData.parents?.[0],
      removeParents: oldParent,
    });
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fileMetaData.name,
      mimeType: fileMetaData.mimeType,
      description: fileMetaData.description,
    }),
  });
  return parseResponse<DriveFile>(res);
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(BASE_URL + '/' + fileId, {
    method: 'DELETE',
    headers,
  });
  await parseResponse<void>(res);
};

export const uploadMedia = async (
  sourceDirPath: string,
): Promise<DriveFile> => {
  const headers = await getAuthHeaders();

  const params: DriveRequestParams = {
    fields: 'id, parents',
    uploadType: 'media',
  };
  const url = MEDIA_UPLOAD_URL + '?' + buildParams(params);
  const response = await NativeZipArchive.remoteZip(
    sourceDirPath,
    url,
    headers,
  );
  let file: DriveFile | undefined;
  try {
    file = JSON.parse(response);
  } catch {
    file = undefined;
  }
  if (!file?.id) {
    throw new DriveRequestError('Google Drive upload did not return a file id');
  }
  return file;
};

export const download = async (file: DriveFile, distDirPath: string) => {
  const headers = await getAuthHeaders();
  const url = BASE_URL + '/' + file.id + '?alt=media';
  return NativeZipArchive.remoteUnzip(distDirPath, url, headers);
};
