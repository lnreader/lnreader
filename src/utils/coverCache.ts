import { useEffect, useState } from 'react';
import NativeFile from '@modules/native-file';
import { type ImageRequestInit } from '@plugins/types';
import { defaultCover } from '@plugins/helpers/constants';

// Compose `Image` can't send headers, but many sources only serve covers with
// the plugin's `imageRequestInit`; those are downloaded once and shown from disk.
const COVER_DIR = `${NativeFile.ExternalCachesDirectoryPath}/covers`;

const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const inFlight = new Map<string, Promise<string>>();
const resolved = new Map<string, string>();

const isRemote = (uri: string) => /^https?:\/\//i.test(uri);

const needsHeaders = (requestInit?: ImageRequestInit) =>
  Boolean(
    requestInit &&
      (Object.keys(requestInit.headers ?? {}).length > 0 ||
        requestInit.body ||
        (requestInit.method && requestInit.method.toUpperCase() !== 'GET')),
  );

const download = async (uri: string, requestInit: ImageRequestInit) => {
  const key = fnv1a(
    uri + JSON.stringify(requestInit.headers) + (requestInit.body ?? ''),
  );
  const path = `${COVER_DIR}/${key}`;
  if (!(await NativeFile.exists(path))) {
    await NativeFile.mkdir(COVER_DIR);
    await NativeFile.downloadFile(
      uri,
      path,
      requestInit.method ?? 'GET',
      requestInit.headers,
      requestInit.body,
    );
  }
  return `file://${path}`;
};

export const resolveCoverUri = (
  uri: string,
  requestInit?: ImageRequestInit,
): Promise<string> => {
  if (!isRemote(uri) || !needsHeaders(requestInit) || !requestInit) {
    return Promise.resolve(uri);
  }
  const cached = resolved.get(uri);
  if (cached) {
    return Promise.resolve(cached);
  }
  let pending = inFlight.get(uri);
  if (!pending) {
    pending = download(uri, requestInit)
      .then(local => {
        resolved.set(uri, local);
        return local;
      })
      .finally(() => inFlight.delete(uri));
    inFlight.set(uri, pending);
  }
  return pending;
};

export type CoverSource =
  | { status: 'missing' }
  | { status: 'loading' }
  | { status: 'ready'; uri: string }
  | { status: 'failed' };

export const isMissingNovelCover = (uri?: string | null) => {
  const normalizedUri = uri?.trim();
  return !normalizedUri || normalizedUri === defaultCover;
};

export const useCoverSource = (
  uri: string | null | undefined,
  requestInit?: ImageRequestInit,
): CoverSource => {
  // Plugins point at a shared "no cover" image; show the placeholder instead.
  const normalized = isMissingNovelCover(uri) ? undefined : uri?.trim();
  const immediate =
    normalized && (!isRemote(normalized) || !needsHeaders(requestInit))
      ? normalized
      : normalized
      ? resolved.get(normalized)
      : undefined;
  const [downloaded, setDownloaded] = useState<{
    uri: string;
    source: CoverSource;
  }>();

  useEffect(() => {
    if (!normalized || immediate) {
      return;
    }
    let cancelled = false;
    resolveCoverUri(normalized, requestInit)
      .then(local => {
        if (!cancelled) {
          setDownloaded({
            uri: normalized,
            source: { status: 'ready', uri: local },
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDownloaded({ uri: normalized, source: { status: 'failed' } });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [immediate, normalized, requestInit]);

  if (!normalized) {
    return { status: 'missing' };
  }
  if (immediate) {
    return { status: 'ready', uri: immediate };
  }
  return downloaded?.uri === normalized
    ? downloaded.source
    : { status: 'loading' };
};
