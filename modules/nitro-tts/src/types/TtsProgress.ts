/**
 * Identifies the paragraph currently owned by native playback.
 *
 * @see {@linkcode TtsSession.addOnProgressChangedListener}
 */
export interface TtsProgress {
  /** Zero-based paragraph index. */
  index: number;
  /** Total number of paragraphs in the active queue. */
  total: number;
  /** Stable identifier of the active paragraph. */
  paragraphId: string;
}
