import { MMKVStorage } from '@utils/mmkv/mmkv';

// The page on screen, per chapter: the progress alone would reopen a chapter
// one page further on.
const key = (chapterId: number) => `READER_POSITION_${chapterId}`;

export const readPosition = (chapterId: number): number | undefined => {
  const value = MMKVStorage.getNumber(key(chapterId));
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;
};

export const writePosition = (chapterId: number, fraction: number) => {
  MMKVStorage.set(key(chapterId), Math.min(1, Math.max(0, fraction)));
};

export const startFraction = (chapterId: number, progress: number | null) => {
  const saved = readPosition(chapterId);
  if (saved !== undefined) {
    return saved;
  }
  // Progress marks how far the screen reached (the end for a finished
  // chapter); open a little before it, where that screen began.
  const read = (progress ?? 0) / 100;
  return read >= 1 ? 1 : Math.max(0, read - 0.05);
};
