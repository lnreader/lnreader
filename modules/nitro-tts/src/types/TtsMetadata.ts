/**
 * Describes the chapter shown by native media controls.
 *
 * @see {@linkcode TtsSession.load}
 */
export interface TtsMetadata {
  /** Novel title displayed as the media artist. */
  novelName: string;
  /** Chapter title displayed as the media title. */
  chapterName: string;
  /** Optional local or remote cover URI. */
  coverUri?: string;
}
