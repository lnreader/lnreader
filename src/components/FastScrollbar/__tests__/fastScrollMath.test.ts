import {
  getScrollProgress,
  getThumbLength,
  progressToIndex,
} from '../fastScrollMath';

describe('fastScrollMath', () => {
  describe('getScrollProgress', () => {
    it('maps offset to 0..1 across the scrollable range', () => {
      expect(getScrollProgress(0, 2000, 1000, 100, 100)).toBe(0);
      expect(getScrollProgress(500, 2000, 1000, 100, 100)).toBe(0.5);
      expect(getScrollProgress(1000, 2000, 1000, 100, 100)).toBe(1);
    });

    it('clamps overscroll', () => {
      expect(getScrollProgress(-50, 2000, 1000, 100, 100)).toBe(0);
      expect(getScrollProgress(1200, 2000, 1000, 100, 100)).toBe(1);
    });

    it('scales progress by the loaded fraction for partially loaded lists', () => {
      // Bottom of the first of four batches sits a quarter of the way down.
      expect(getScrollProgress(1000, 2000, 1000, 1000, 4000)).toBe(0.25);
    });

    it('returns 0 when the content does not scroll', () => {
      expect(getScrollProgress(0, 500, 1000, 10, 10)).toBe(0);
      expect(getScrollProgress(0, 2000, 1000, 0, 0)).toBe(0);
    });
  });

  describe('progressToIndex', () => {
    it('maps progress to the nearest index', () => {
      expect(progressToIndex(0, 5000)).toBe(0);
      expect(progressToIndex(0.5, 5001)).toBe(2500);
      expect(progressToIndex(1, 5000)).toBe(4999);
      expect(progressToIndex(1.2, 5000)).toBe(4999);
    });

    it('returns -1 for empty lists', () => {
      expect(progressToIndex(0.5, 0)).toBe(-1);
    });
  });

  describe('getThumbLength', () => {
    it('is proportional to the visible fraction of the content', () => {
      // 1000px track, viewport shows a quarter of the content.
      expect(getThumbLength(1000, 4000, 1000, 100, 100, 48)).toBe(250);
    });

    it('never exceeds the track', () => {
      expect(getThumbLength(1000, 1000, 1000, 10, 10, 48)).toBe(1000);
    });

    it('applies the minimum length on very long lists', () => {
      expect(getThumbLength(1000, 320000, 1000, 5000, 5000, 48)).toBe(48);
    });

    it('extrapolates content length from the loaded fraction', () => {
      // 1 of 4 batches loaded: full content is ~4x what is measured.
      expect(getThumbLength(1000, 2000, 1000, 1000, 4000, 48)).toBe(125);
    });

    it('handles an unmeasured list', () => {
      expect(getThumbLength(0, 0, 0, 0, 0, 48)).toBe(0);
      expect(getThumbLength(500, 0, 0, 0, 0, 48)).toBe(48);
    });
  });
});
