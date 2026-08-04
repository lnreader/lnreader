import { getMMKVObject } from '@utils/mmkv/mmkv';
import type { TrackerMetadata } from '@hooks/persisted/useTracker';
import type { TrackerName } from '@services/Trackers';

const REDACTED = '<redacted>';

/**
 * Matches the `TRACKERS` MMKV key exported from `@hooks/persisted/useTracker`.
 * Hardcoded (rather than imported) so this low-level module doesn't pull the
 * tracker auth flows (WebBrowser, Linking, per-tracker API clients) into the
 * import graph of every file that logs.
 */
const TRACKERS_MMKV_KEY = 'TRACKERS';

const SENSITIVE_KEYS = [
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'client_secret',
  'clientSecret',
  'api_key',
  'apiKey',
  'password',
  'code',
];

const SENSITIVE_HEADERS = ['Authorization', 'Cookie', 'Set-Cookie'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactHeaderLines(input: string): string {
  const pattern = new RegExp(
    `^(\\s*(?:${SENSITIVE_HEADERS.join('|')})\\s*:\\s*).+$`,
    'gim',
  );
  return input.replace(pattern, `$1${REDACTED}`);
}

function redactBearerTokens(input: string): string {
  return input.replace(
    /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    `Bearer ${REDACTED}`,
  );
}

function redactStructuredValues(input: string): string {
  let result = input;
  for (const key of [...SENSITIVE_KEYS, ...SENSITIVE_HEADERS]) {
    const escapedKey = escapeRegExp(key);
    result = result.replace(
      new RegExp(`("${escapedKey}"\\s*:\\s*")([^"]*)(")`, 'gi'),
      `$1${REDACTED}$3`,
    );
  }
  for (const key of SENSITIVE_KEYS) {
    const escapedKey = escapeRegExp(key);
    result = result.replace(
      new RegExp(`(\\b${escapedKey}=)([^&\\s"']+)`, 'gi'),
      `$1${REDACTED}`,
    );
  }
  return result;
}

function redactKnownTrackerTokens(input: string): string {
  const trackers =
    getMMKVObject<Partial<Record<TrackerName, TrackerMetadata>>>(
      TRACKERS_MMKV_KEY,
    );
  if (!trackers) {
    return input;
  }
  let result = input;
  for (const meta of Object.values(trackers)) {
    const auth = meta?.auth;
    if (!auth) {
      continue;
    }
    for (const value of [auth.accessToken, auth.refreshToken]) {
      if (value && value.length > 3) {
        result = result.split(value).join(REDACTED);
      }
    }
  }
  return result;
}

/**
 * Scrubs OAuth tokens, cookies and auth headers from text before it is
 * persisted to the log buffer or shared as a crash dump.
 */
export function redact(input: string): string {
  if (!input) {
    return input;
  }
  let result = input;
  result = redactHeaderLines(result);
  result = redactBearerTokens(result);
  result = redactStructuredValues(result);
  result = redactKnownTrackerTokens(result);
  return result;
}
