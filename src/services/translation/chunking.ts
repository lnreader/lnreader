/**
 * Splitting a chapter into provider-sized requests.
 *
 * Chapters are chunked rather than sent whole for two reasons from the spec
 * (§6.5): provider payload limits, and bounding the blast radius of a single
 * failed request so one bad chunk doesn't cost the whole chapter.
 */

/** Spec §6.5 recommends 20–100 paragraphs per request. */
export const MIN_CHUNK_SIZE = 1;
export const MAX_CHUNK_SIZE = 100;
export const DEFAULT_CHUNK_SIZE = 40;

/** Phase 1 ships a fixed delay; Phase 2 makes it user-configurable. */
export const DEFAULT_REQUEST_DELAY_MS = 500;
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

export const clampChunkSize = (size: number): number => {
  if (!Number.isFinite(size)) {
    return DEFAULT_CHUNK_SIZE;
  }
  return Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, Math.floor(size)));
};

/**
 * A contiguous run of segments sent as one provider request.
 *
 * `start` is the index into the original segment array, which is what lets a
 * partially-failed chapter be reassembled with the untranslated source left
 * in place at exactly the right positions.
 */
export interface TranslationChunk {
  index: number;
  start: number;
  texts: string[];
}

export const splitIntoChunks = (
  segments: string[],
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): TranslationChunk[] => {
  const size = clampChunkSize(chunkSize);
  const chunks: TranslationChunk[] = [];
  for (let start = 0; start < segments.length; start += size) {
    chunks.push({
      index: chunks.length,
      start,
      texts: segments.slice(start, start + size),
    });
  }
  return chunks;
};
