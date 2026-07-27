import {
  DEFAULT_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
  clampChunkSize,
  splitIntoChunks,
} from '../chunking';

describe('clampChunkSize', () => {
  it('keeps a size inside the supported range', () => {
    expect(clampChunkSize(25)).toBe(25);
  });

  it('clamps to the documented bounds', () => {
    expect(clampChunkSize(0)).toBe(1);
    expect(clampChunkSize(-10)).toBe(1);
    expect(clampChunkSize(5000)).toBe(MAX_CHUNK_SIZE);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampChunkSize(NaN)).toBe(DEFAULT_CHUNK_SIZE);
    expect(clampChunkSize(Infinity)).toBe(DEFAULT_CHUNK_SIZE);
  });

  it('floors fractional sizes', () => {
    expect(clampChunkSize(10.9)).toBe(10);
  });
});

describe('splitIntoChunks', () => {
  const segments = Array.from({ length: 10 }, (_, i) => `p${i}`);

  it('splits into contiguous runs that cover every segment exactly once', () => {
    const chunks = splitIntoChunks(segments, 3);

    expect(chunks.map(c => c.texts)).toEqual([
      ['p0', 'p1', 'p2'],
      ['p3', 'p4', 'p5'],
      ['p6', 'p7', 'p8'],
      ['p9'],
    ]);
    expect(chunks.flatMap(c => c.texts)).toEqual(segments);
  });

  it('records the source offset so failures map back to segment positions', () => {
    expect(splitIntoChunks(segments, 4).map(c => c.start)).toEqual([0, 4, 8]);
  });

  it('numbers chunks sequentially for retry targeting', () => {
    expect(splitIntoChunks(segments, 4).map(c => c.index)).toEqual([0, 1, 2]);
  });

  it('returns nothing for an empty document', () => {
    expect(splitIntoChunks([], 10)).toEqual([]);
  });

  it('produces a single chunk when the size exceeds the document', () => {
    expect(splitIntoChunks(segments, 100)).toHaveLength(1);
  });
});
