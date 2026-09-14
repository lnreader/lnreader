/**
 * Google Translate (Enhanced) provider — `translate-pa.googleapis.com/v1/translateHtml`,
 * the same endpoint NoveLA (WtrLab plugin) uses. Sends HTML-wrapped paragraphs,
 * which gives significantly better quality than the plain-text endpoint.
 *
 * NoveLA-compatible key management:
 *  - users may add keys (one per line); the shared community key is the fallback
 *  - the last verified-working key is cached for 24h (persisted via the caller)
 *  - if no configured key works, it's auto-discovered from wtr-lab.com (ranking →
 *    first novel → chapter-1 → inline `X-Goog-API-Key` header or `_next` JS bundles)
 *
 * Paragraphs are chunked into 8000-char HTML blocks (`<br>`-joined), sent with a
 * short delay, entities are unescaped, and a single failed chunk keeps its
 * original text — the chapter only errors when every chunk fails.
 */

import { fetchTimeout } from '@utils/fetch/fetch';
import { TranslationError } from './types';

const DEFAULT_GOOGLE_PA_COMMUNITY_KEY =
  'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520';

const GOOGLE_PA_TRANSLATE_URL =
  'https://translate-pa.googleapis.com/v1/translateHtml';
const WTR_LAB_URL = 'https://wtr-lab.com';
const KEY_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_CHUNK_CHARS = 8000;
const DELAY_BETWEEN_CHUNKS_MS = 400;
const TIMEOUT_MS = 60000;

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const KEY_HEADER_REGEX = /"X-Goog-API-Key"\s*:\s*"([^"]+)"/;
const NOVEL_HREF_REGEX = /href=["']([^"']*\/novel\/[^"']+)["']/;
const NEXT_SCRIPT_REGEX =
  /<script[^>]+src=["']([^"']*\/_next\/[^"']+\.js[^"']*)["']/g;

const htmlNumericEntity = /&#(\d+);/g;
const brTag = /<br\s*\/?>/gi;

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/** NoveLA key lists: one per line, or comma/semicolon separated. */
export const parseGooglePaApiKeys = (raw: string): string[] => {
  if (!raw) return [];
  return raw
    .split(/[\n;,]/)
    .map(key => key.trim())
    .filter(key => key.length > 0);
};

/**
 * Effective key list: the stored list, else the legacy personal key, else the
 * shared community key (matches NoveLA's default seed).
 */
export const resolveGooglePaApiKeys = (options: {
  googlePaApiKeys: string;
  googlePaApiKey: string;
  useCommunityGooglePaKey: boolean;
}): string[] => {
  const stored = parseGooglePaApiKeys(options.googlePaApiKeys);
  if (stored.length > 0) return stored;
  const legacy = options.googlePaApiKey.trim();
  if (legacy) return [legacy];
  if (options.useCommunityGooglePaKey) return [DEFAULT_GOOGLE_PA_COMMUNITY_KEY];
  return [];
};

export interface GooglePaTranslationOptions {
  /** Effective key list (see {@link resolveGooglePaApiKeys}). */
  apiKeys: string[];
  /** Last verified-working key ('' when unknown). */
  cachedKey: string;
  /** Unix ms of the last successful key check (0 = none). */
  keyLastChecked: number;
  /** Called with the refreshed 24h key cache; persist it in settings. */
  persistKeyCache?: (cachedKey: string, lastChecked: number) => void;
  /** Called when a key was auto-discovered and prepended to the list. */
  persistApiKeys?: (keys: string[]) => void;
  sourceLanguage: string;
  targetLanguage: string;
}

// Single-flight guard so concurrent chapters don't hammer wtr-lab at once.
let keyFetchInFlight: Promise<string> | null = null;

// ─── Key management ────────────────────────────────────────────────────────

const checkKey = async (key: string): Promise<boolean> => {
  try {
    const payload = JSON.stringify([[[`<p>test</p>`, 'en', 'en'], 'wt_lib']]);
    const response = await fetchTimeout(
      GOOGLE_PA_TRANSLATE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json+protobuf',
          'X-Goog-API-Key': key,
          Origin: 'https://translate.google.com',
        },
        body: payload,
      },
      TIMEOUT_MS,
    );
    const ok = response.ok;
    await response.text().catch(() => '');
    return ok;
  } catch {
    return false;
  }
};

const fetchKeyFromWtrLab = async (): Promise<string | null> => {
  try {
    const rankingHtml = await fetchTimeout(
      `${WTR_LAB_URL}/en/ranking/monthly`,
      { headers: { 'User-Agent': USER_AGENT } },
      TIMEOUT_MS,
    )
      .then(r => (r.ok ? r.text() : ''))
      .catch(() => '');

    const match = NOVEL_HREF_REGEX.exec(rankingHtml);
    if (!match) return null;
    const novelUrl = match[1].startsWith('http')
      ? match[1]
      : `${WTR_LAB_URL}${match[1]}`;

    const chapterHtml = await fetchTimeout(
      `${novelUrl.replace(/\/+$/, '')}/chapter-1`,
      { headers: { 'User-Agent': USER_AGENT } },
      TIMEOUT_MS,
    )
      .then(r => (r.ok ? r.text() : ''))
      .catch(() => '');

    const inline = KEY_HEADER_REGEX.exec(chapterHtml);
    if (inline) return inline[1];

    for (const url of collectNextScripts(chapterHtml)) {
      try {
        const js = await fetchTimeout(
          url,
          { headers: { 'User-Agent': USER_AGENT } },
          TIMEOUT_MS,
        )
          .then(r => (r.ok ? r.text() : ''))
          .catch(() => '');
        const found = KEY_HEADER_REGEX.exec(js);
        if (found) return found[1];
      } catch {
        // keep scanning
      }
    }
  } catch {
    // fall through to null
  }
  return null;
};

const collectNextScripts = (html: string): string[] =>
  [...html.matchAll(NEXT_SCRIPT_REGEX)]
    .map(match => match[1])
    .map(url => (url.startsWith('http') ? url : `${WTR_LAB_URL}${url}`))
    .filter(
      url => !url.includes('_buildManifest') && !url.includes('_ssgManifest'),
    )
    .filter((url, index, all) => all.indexOf(url) === index);

/**
 * Resolve a currently-working key: fresh cache → configured keys (first hit
 * re-caches) → wtr-lab discovery (prepended to the list) → error.
 */
const resolveWorkingKey = async (
  options: GooglePaTranslationOptions,
): Promise<string> => {
  const { apiKeys, cachedKey, keyLastChecked } = options;
  const now = Date.now();
  if (cachedKey && now - keyLastChecked < KEY_CACHE_DURATION_MS) {
    return cachedKey;
  }

  // Single-flight: another in-progress resolution covers concurrent callers.
  keyFetchInFlight ??= (async () => {
    for (const key of apiKeys) {
      if (await checkKey(key)) {
        options.persistKeyCache?.(key, Date.now());
        return key;
      }
    }
    const discovered = await fetchKeyFromWtrLab();
    if (discovered) {
      const merged = [discovered, ...apiKeys.filter(k => k !== discovered)];
      if (merged.length !== apiKeys.length) {
        options.persistApiKeys?.(merged);
      }
      options.persistKeyCache?.(discovered, Date.now());
      return discovered;
    }
    throw new TranslationError(
      'GOOGLE_PA',
      'No working Google PA API key found. Check your keys in Settings.',
    );
  })().finally(() => {
    keyFetchInFlight = null;
  });

  return keyFetchInFlight;
};

// ─── Translation ───────────────────────────────────────────────────────────

const unescapeHtmlEntities = (text: string): string =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(htmlNumericEntity, (entity, digits: string) => {
      const codePoint = Number.parseInt(digits, 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    });

const translateHtml = async (
  html: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
): Promise<string> => {
  const payload = JSON.stringify([[[html, sourceLang, targetLang], 'wt_lib']]);
  const response = await fetchTimeout(
    GOOGLE_PA_TRANSLATE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json+protobuf',
        'X-Goog-API-Key': apiKey,
        Origin: 'https://translate.google.com',
      },
      body: payload,
    },
    TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new TranslationError(
      'GOOGLE_PA',
      `Google PA returned HTTP ${response.status}.`,
    );
  }
  const data: unknown = await response.json().catch(() => null);
  const translated = (data as any)?.[0]?.[0];
  if (typeof translated !== 'string') {
    throw new TranslationError(
      'GOOGLE_PA',
      'Google PA returned an unexpected response.',
    );
  }
  return translated;
};

const buildHtmlChunks = (
  paragraphs: string[],
): { indices: number[]; html: string }[] => {
  const chunks: { indices: number[]; html: string }[] = [];
  let currentIndices: number[] = [];
  let currentParts: string[] = [];
  let currentLen = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (currentLen > 0 && currentLen + para.length + 4 > MAX_CHUNK_CHARS) {
      chunks.push({ indices: currentIndices, html: currentParts.join('<br>') });
      currentIndices = [];
      currentParts = [];
      currentLen = 0;
    }
    currentIndices.push(i);
    currentParts.push(para);
    currentLen += para.length + 4;
  }
  if (currentParts.length > 0) {
    chunks.push({ indices: currentIndices, html: currentParts.join('<br>') });
  }
  return chunks;
};

export interface TranslateViaGooglePaOptions
  extends GooglePaTranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

const translateChunks = async (
  paragraphs: string[],
  sourceLanguage: string,
  targetLanguage: string,
  options: GooglePaTranslationOptions,
): Promise<string[]> => {
  const result = [...paragraphs];
  const chunks = buildHtmlChunks(paragraphs);
  if (chunks.length === 0) return result;

  const sourceLang = sourceLanguage === 'auto' ? 'auto' : sourceLanguage;
  const apiKey = await resolveWorkingKey(options);
  let failedChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await delay(DELAY_BETWEEN_CHUNKS_MS);
    const chunk = chunks[i];
    let translated: string;
    try {
      translated = await translateHtml(
        chunk.html,
        sourceLang,
        targetLanguage,
        apiKey,
      );
    } catch {
      failedChunks++;
      continue;
    }
    if (translated === chunk.html) continue;

    const translatedParas = translated
      .replace(brTag, '\n')
      .split('\n')
      .map(line => unescapeHtmlEntities(line.trim()));

    for (
      let j = 0;
      j < Math.min(translatedParas.length, chunk.indices.length);
      j++
    ) {
      result[chunk.indices[j]] = translatedParas[j];
    }
  }

  if (failedChunks === chunks.length) {
    throw new TranslationError(
      'GOOGLE_PA',
      'Google PA failed to translate. Check your network connection.',
    );
  }
  return result;
};

export const translateViaGooglePa = (
  texts: string[],
  options: TranslateViaGooglePaOptions,
): Promise<string[]> =>
  translateChunks(
    texts,
    options.sourceLanguage,
    options.targetLanguage,
    options,
  );
