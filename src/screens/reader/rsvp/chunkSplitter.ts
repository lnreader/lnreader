/**
 * RSVP chunk splitter (spec-1576 R1/R3) — pure function, no DOM.
 *
 * Splits normalized text into flash chunks of up to `chunkSize` words.
 * Tokens longer than 12 characters are split into pieces of at most 12
 * characters, each piece flashed separately; pieces are flagged so the
 * renderer can draw continuation ellipses. Every chunk carries the ORP
 * index of its display text (center letter, left-of-center when even).
 */

export interface FlashChunk {
  text: string;
  orpIndex: number;
  /** This chunk is an earlier piece of a split long token. */
  continuesNext: boolean;
  /** This chunk is a later piece of a split long token. */
  continuationOfPrev: boolean;
}

export const MAX_TOKEN_LENGTH = 12;

const orpIndexOf = (text: string): number =>
  Math.max(0, Math.floor((text.length - 1) / 2));

const longTokenChunks = (token: string): FlashChunk[] => {
  const pieces: FlashChunk[] = [];
  for (let start = 0; start < token.length; start += MAX_TOKEN_LENGTH) {
    const text = token.slice(start, start + MAX_TOKEN_LENGTH);
    pieces.push({
      text,
      orpIndex: orpIndexOf(text),
      continuesNext: false,
      continuationOfPrev: false,
    });
  }
  if (pieces.length > 1) {
    for (let i = 0; i < pieces.length; i++) {
      pieces[i].continuesNext = i < pieces.length - 1;
      pieces[i].continuationOfPrev = i > 0;
    }
  }
  return pieces;
};

export const chunkSplitter = (
  text: string,
  chunkSize: number,
): FlashChunk[] => {
  if (!text || !text.trim()) return [];

  const size = Math.min(3, Math.max(1, Math.floor(chunkSize)));
  const chunks: FlashChunk[] = [];

  let group: string[] = [];
  const flushGroup = () => {
    while (group.length > 0) {
      const slice = group.slice(0, size);
      group = group.slice(slice.length);
      const joined = slice.join(' ');
      chunks.push({
        text: joined,
        orpIndex: orpIndexOf(joined),
        continuesNext: false,
        continuationOfPrev: false,
      });
    }
  };

  for (const token of text.split(' ')) {
    if (!token) continue;
    if (token.length > MAX_TOKEN_LENGTH) {
      flushGroup();
      chunks.push(...longTokenChunks(token));
    } else {
      group.push(token);
      if (group.length === size) {
        flushGroup();
      }
    }
  }
  flushGroup();

  return chunks;
};
