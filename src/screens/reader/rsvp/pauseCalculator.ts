/**
 * RSVP pause calculator (spec-1576 R2) — pure function, no DOM.
 *
 * Base flash interval is 60000/WPM; the chunk's FINAL character buys a
 * proportional pause: paragraph break ×3, sentence end ×2.5,
 * comma-class ×1.5, otherwise ×1. Always a positive integer ms.
 */

export type PauseMultiplier = 1 | 1.5 | 2.5 | 3;

export const pauseMultiplierFor = (chunk: string): PauseMultiplier => {
  const last = chunk.length ? chunk[chunk.length - 1] : '';
  switch (last) {
    case '\n':
      return 3;
    case '.':
    case '!':
    case '?':
      return 2.5;
    case ',':
    case ';':
    case ':':
      return 1.5;
    default:
      return 1;
  }
};

export const pauseCalculator = (chunk: string, wpm: number): number => {
  const base = 60000 / Math.max(1, wpm);
  return Math.round(base * pauseMultiplierFor(chunk));
};
