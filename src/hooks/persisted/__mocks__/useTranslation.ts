export const translateChapter = jest.fn(() => Promise.resolve());
export const translateChapters = jest.fn(() => Promise.resolve());
export const clearTranslation = jest.fn(() => Promise.resolve());
export const clearAllTranslations = jest.fn(() => Promise.resolve());
export const isTranslating = jest.fn(() => false);
export const isAnyTranslating = false;

export const translatingIds = new Set<number>();

export const useTranslation = jest.fn(() => ({
  translatingIds,
  translateChapter,
  translateChapters,
  clearTranslation,
  clearAllTranslations,
  isTranslating,
  isAnyTranslating,
}));

