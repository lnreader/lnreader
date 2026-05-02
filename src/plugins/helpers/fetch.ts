/* eslint-disable no-bitwise */
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import NativeFile from '@specs/NativeFile';
import { parse as parseProto } from 'protobufjs';

type FetchInit = {
  headers?: Record<string, string> | Headers;
  method?: string;
  body?: FormData | string;
  [x: string]: string | Record<string, string> | undefined | FormData | Headers;
};

const makeInit = (init?: FetchInit) => {
  const defaultHeaders = {
    'Connection': 'keep-alive',
    'Accept': '*/*',
    'Accept-Language': '*',
    'Sec-Fetch-Mode': 'cors',
    'Accept-Encoding': 'gzip, deflate',
    'Cache-Control': 'max-age=0',
    'User-Agent': getUserAgent(),
  };
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      if (!init.headers.get('User-Agent') && defaultHeaders['User-Agent']) {
        init.headers.set('User-Agent', defaultHeaders['User-Agent']);
      }
    } else {
      init.headers = {
        ...defaultHeaders,
        ...init.headers,
      };
    }
  } else {
    init = {
      ...init,
      headers: defaultHeaders,
    };
  }
  return init;
};

const headersToObject = (
  headers?: Record<string, string> | Headers,
): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!headers) {
    return out;
  }
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
};

const isCloudflareChallengeBody = (body: string): boolean =>
  /Just a moment\.\.\.|cf_chl_opt|challenge-platform|cf-mitigated/i.test(body);

const cacheDir =
  NativeFile.getConstants().ExternalCachesDirectoryPath ?? '/data/local/tmp';

let webFetchSeq = 0;

const webFetch = async (
  url: string,
  init: FetchInit,
): Promise<Response | undefined> => {
  const tempPath = `${cacheDir}/web_fetch_${Date.now()}_${webFetchSeq++}.bin`;
  try {
    await NativeFile.downloadFile(
      url,
      tempPath,
      init.method || 'get',
      headersToObject(init.headers),
      init.body?.toString(),
    );
    if (!NativeFile.exists(tempPath)) {
      return undefined;
    }
    const text = NativeFile.readFile(tempPath);
    return new Response(text, { status: 200 });
  } catch {
    return undefined;
  } finally {
    try {
      if (NativeFile.exists(tempPath)) {
        NativeFile.unlink(tempPath);
      }
    } catch {
      /* ignore */
    }
  }
};

export const fetchApi = async (
  url: string,
  init?: FetchInit,
): Promise<Response> => {
  const finalInit = makeInit(init);
  const response = await fetch(url, finalInit);
  const status = response.status;
  if (status !== 403 && status !== 503) {
    return response;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!/text\/html/i.test(contentType)) {
    return response;
  }
  const cloned = response.clone();
  const body = await cloned.text();
  if (!isCloudflareChallengeBody(body)) {
    return new Response(body, {
      status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  const retried = await webFetch(url, finalInit);
  if (retried) {
    return retried;
  }
  return new Response(body, {
    status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

const FILE_READER_PREFIX_LENGTH = 'data:application/octet-stream;base64,'
  .length;

export const downloadFile = async (
  url: string,
  destPath: string,
  init?: FetchInit,
): Promise<void> => {
  init = makeInit(init);
  return NativeFile.downloadFile(
    url,
    destPath,
    init.method || 'get',
    init.headers as Record<string, string>,
    init.body?.toString(),
  );
};

/**
 *
 * @param url
 * @param init
 * @param encoding link: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/encoding
 * @returns plain text
 */
export const fetchText = async (
  url: string,
  init?: FetchInit,
  encoding?: string,
): Promise<string> => {
  init = makeInit(init);
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error();
    }
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => {
        resolve(fr.result as string);
      };
      fr.onerror = () => reject();
      fr.onabort = () => reject();
      fr.readAsText(blob, encoding);
    });
  } catch {
    return '';
  }
};

function base64ToBytesArr(str: string) {
  const abc = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  ]; // base64 alphabet
  const result = [];

  for (let i = 0; i < str.length / 4; i++) {
    const chunk = [...str.slice(4 * i, 4 * i + 4)];
    const bin = chunk
      .map(x => abc.indexOf(x).toString(2).padStart(6, '0'))
      .join('');
    const bytes = bin.match(/.{1,8}/g)?.map(x => +('0b' + x)) || [];
    result.push(
      ...bytes.slice(
        0,
        3 - Number(str[4 * i + 2] === '=') - Number(str[4 * i + 3] === '='),
      ),
    );
  }
  return result;
}

interface ProtoRequestInit {
  // merged .proto file
  proto: string;
  requestType: string;
  requestData?: any;
  responseType: string;
}

const BYTE_MARK = BigInt((1 << 8) - 1);

export const fetchProto = async function (
  protoInit: ProtoRequestInit,
  url: string,
  init?: FetchInit,
) {
  const protoRoot = parseProto(protoInit.proto).root;
  const RequestMessge = protoRoot.lookupType(protoInit.requestType);
  if (RequestMessge.verify(protoInit.requestData)) {
    throw new Error('Invalid Proto');
  }
  // encode request data
  const encodedrequest = RequestMessge.encode(protoInit.requestData).finish();
  const requestLength = BigInt(encodedrequest.length);
  const headers = new Uint8Array(
    Array(5)
      .fill(0)
      .map((v, idx) => {
        if (idx === 0) {
          return 0;
        }
        return Number((requestLength >> BigInt(8 * (5 - idx - 1))) & BYTE_MARK);
      }),
  );
  init = await makeInit(init);
  const bodyArray = new Uint8Array(headers.length + encodedrequest.length);
  bodyArray.set(headers, 0);
  bodyArray.set(encodedrequest, headers.length);

  return fetch(url, {
    method: 'POST',
    ...init,
    body: bodyArray,
  } as RequestInit)
    .then(r => r.blob())
    .then(blob => {
      // decode response data
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => {
          const payload = new Uint8Array(
            base64ToBytesArr(
              fr.result?.slice(FILE_READER_PREFIX_LENGTH) as string,
            ),
          );
          const length = Number(
            BigInt(payload[1] << 24) |
              BigInt(payload[2] << 16) |
              BigInt(payload[3] << 8) |
              BigInt(payload[4]),
          );
          const ResponseMessage = protoRoot.lookupType(protoInit.responseType);
          resolve(ResponseMessage.decode(payload.slice(5, 5 + length)));
        };
        fr.onerror = () => reject();
        fr.onabort = () => reject();
        fr.readAsDataURL(blob);
      });
    });
};
