/**
 * Chapter translation orchestrator.
 *
 * Owns the sequence the providers deliberately don't know about: segmenting
 * the document, chunking it, pacing requests, arming per-request timeouts, and
 * — the part that matters most for spec §7's resilience requirement —
 * surviving a failed chunk.
 *
 * A chunk that fails leaves its segments in the source language and records
 * the failure. The chapter still renders, the user can see that part of it
 * didn't translate, and a retry re-runs only the chunks that failed.
 */
import { sleep } from '@utils/sleep';

import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_REQUEST_DELAY_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  splitIntoChunks,
  type TranslationChunk,
} from './chunking';
import { segmentHtml } from './htmlSegments';
import { getTranslationProvider } from './providers';
import { getApiKey } from './secureStorage';
import { writeTranslatedChapter, type ChapterLocation } from './storage';
import {
  TranslationError,
  type SourceLanguage,
  type TranslationConfig,
} from './types';

export interface ChunkFailure {
  chunkIndex: number;
  /** Segment range left untranslated, for surfacing "paragraphs 40–80 failed". */
  start: number;
  count: number;
  kind: TranslationError['kind'];
  retryable: boolean;
  message: string;
}

export interface TranslateChapterOptions {
  html: string;
  config: TranslationConfig;
  targetLang: string;
  sourceLang?: SourceLanguage;
  chunkSize?: number;
  requestDelayMs?: number;
  requestTimeoutMs?: number;
  /** Cancels the whole run — e.g. the reader navigating away. */
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  /** Restricts the run to these chunk indices, for retrying failures. */
  onlyChunks?: ReadonlySet<number>;
}

export interface TranslateChapterResult {
  html: string;
  totalChunks: number;
  failures: ChunkFailure[];
  /** True when every chunk succeeded. */
  complete: boolean;
  /** True when nothing in the document needed translating. */
  empty: boolean;
}

/**
 * Races a provider call against the configured timeout.
 *
 * The timer is always cleared, including on the success path — an outstanding
 * timer would keep a handle alive and could abort a controller the next chunk
 * is no longer using.
 */
const withTimeout = async <T>(
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', forwardAbort);

  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', forwardAbort);
  }
};

const toChunkFailure = (
  chunk: TranslationChunk,
  error: unknown,
): ChunkFailure => {
  const translationError =
    error instanceof TranslationError
      ? error
      : new TranslationError(
          'bad-response',
          error instanceof Error ? error.message : String(error),
        );

  return {
    chunkIndex: chunk.index,
    start: chunk.start,
    count: chunk.texts.length,
    kind: translationError.kind,
    retryable: translationError.retryable,
    message: translationError.message,
  };
};

export const translateChapterHtml = async ({
  html,
  config,
  targetLang,
  sourceLang = 'auto',
  chunkSize = DEFAULT_CHUNK_SIZE,
  requestDelayMs = DEFAULT_REQUEST_DELAY_MS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  signal,
  onProgress,
  onlyChunks,
}: TranslateChapterOptions): Promise<TranslateChapterResult> => {
  const { segments, rebuild } = segmentHtml(html);

  if (segments.length === 0) {
    return {
      html,
      totalChunks: 0,
      failures: [],
      complete: true,
      empty: true,
    };
  }

  const provider = getTranslationProvider(config.provider);
  const apiKey = await getApiKey(config.provider);

  if (provider.requiresApiKey(config) && !apiKey) {
    throw new TranslationError(
      'auth',
      `No API key is configured for ${config.provider}.`,
    );
  }

  const chunks = splitIntoChunks(segments, chunkSize);
  const pending = onlyChunks
    ? chunks.filter(chunk => onlyChunks.has(chunk.index))
    : chunks;

  const translations = new Array<string | undefined>(segments.length);
  const failures: ChunkFailure[] = [];

  for (let i = 0; i < pending.length; i++) {
    if (signal?.aborted) {
      throw new TranslationError('timeout', 'Translation was cancelled.');
    }

    const chunk = pending[i];

    try {
      const result = await withTimeout(requestTimeoutMs, signal, chunkSignal =>
        provider.translateBatch(chunk.texts, {
          config,
          apiKey,
          sourceLang,
          targetLang,
          signal: chunkSignal,
        }),
      );

      // Providers are contracted to return a same-length array, but a
      // third-party response is untrusted input — verify rather than write
      // misaligned text back into the document.
      if (result.length !== chunk.texts.length) {
        throw new TranslationError(
          'bad-response',
          `Provider returned ${result.length} segments for ${chunk.texts.length} inputs.`,
        );
      }

      for (let j = 0; j < result.length; j++) {
        translations[chunk.start + j] = result[j];
      }
    } catch (error) {
      // A cancelled run stops immediately; only per-chunk faults are absorbed.
      if (signal?.aborted) {
        throw new TranslationError('timeout', 'Translation was cancelled.');
      }
      failures.push(toChunkFailure(chunk, error));
    }

    onProgress?.(i + 1, pending.length);

    // Pace requests to the same provider, but never pay the delay after the
    // final chunk.
    if (requestDelayMs > 0 && i < pending.length - 1) {
      await sleep(requestDelayMs);
    }
  }

  return {
    html: rebuild(translations),
    totalChunks: chunks.length,
    failures,
    complete: failures.length === 0,
    empty: false,
  };
};

/**
 * Translates a chapter and caches the result on disk.
 *
 * A partially failed chapter is still written: the untranslated remainder is
 * intact source text, which is more useful than discarding the work, and the
 * returned failures tell the caller what to offer a retry for.
 */
export const translateChapter = async (
  location: ChapterLocation,
  options: TranslateChapterOptions,
): Promise<TranslateChapterResult> => {
  const result = await translateChapterHtml(options);

  if (!result.empty) {
    await writeTranslatedChapter(location, options.targetLang, result.html);
  }

  return result;
};
