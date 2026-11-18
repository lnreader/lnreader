const clamp01 = (value: number) => {
  'worklet';
  return value < 0 ? 0 : value > 1 ? 1 : value;
};

/**
 * Scroll progress across the whole data set. When only part of the data is
 * loaded (batched lists), the measured content only covers `loadedCount`
 * items, so progress is scaled down to keep the thumb stable as batches arrive.
 */
export const getScrollProgress = (
  offset: number,
  contentLength: number,
  viewportLength: number,
  loadedCount: number,
  totalCount: number,
) => {
  'worklet';
  const scrollable = contentLength - viewportLength;
  if (scrollable <= 0 || totalCount <= 0) {
    return 0;
  }
  const progress = clamp01(offset / scrollable);
  return loadedCount >= totalCount
    ? progress
    : progress * (loadedCount / totalCount);
};

export const progressToIndex = (progress: number, totalCount: number) => {
  'worklet';
  if (totalCount <= 0) {
    return -1;
  }
  return Math.round(clamp01(progress) * (totalCount - 1));
};

export const isFastScrollUseful = (
  contentLength: number,
  viewportLength: number,
  loadedCount: number,
  totalCount: number,
  minScreens: number,
) => {
  'worklet';
  if (viewportLength <= 0 || loadedCount <= 0 || totalCount <= 0) {
    return false;
  }
  const estimatedLength = contentLength * (totalCount / loadedCount);
  return estimatedLength >= viewportLength * minScreens;
};
