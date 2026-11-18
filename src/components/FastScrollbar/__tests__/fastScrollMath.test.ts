import {
  getScrollProgress,
  isFastScrollUseful,
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

  describe('isFastScrollUseful', () => {
    it('requires the estimated content to span several screens', () => {
      expect(isFastScrollUseful(3000, 1000, 50, 50, 4)).toBe(false);
      expect(isFastScrollUseful(4000, 1000, 50, 50, 4)).toBe(true);
    });

    it('extrapolates content length from the loaded fraction', () => {
      expect(isFastScrollUseful(2000, 1000, 1000, 2000, 4)).toBe(true);
    });

    it('is disabled before layout or without data', () => {
      expect(isFastScrollUseful(4000, 0, 50, 50, 4)).toBe(false);
      expect(isFastScrollUseful(4000, 1000, 0, 0, 4)).toBe(false);
    });
  });
});
