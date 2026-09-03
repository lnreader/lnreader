/**
 * A character span within the active paragraph, fired as speech advances.
 *
 * Offsets are UTF-16 code units relative to the start of the paragraph text as
 * passed to {@linkcode TtsSession.load}. Not every engine reports ranges:
 * when it doesn't, no word-range events are emitted and consumers fall back to
 * paragraph-level progress only.
 *
 * @see {@linkcode TtsSession.addOnWordRangeChangedListener}
 */
export interface TtsWordRange {
  /** Stable identifier of the paragraph the range belongs to. */
  paragraphId: string;
  /** Index of the first code unit in the range, inclusive. */
  start: number;
  /** Index of the first code unit past the range, exclusive. */
  end: number;
}