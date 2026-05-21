export const translateChapter = jest.fn(() => Promise.resolve());
export const translateChapters = jest.fn(() => Promise.resolve());
export const clearTranslation = jest.fn(() => Promise.resolve());
export const isTranslating = jest.fn(() => false);
export const isAnyTranslating = false;

export const useTranslation = jest.fn(() => ({
  translateChapter,
  translateChapters,
  clearTranslation,
  isTranslating,
  isAnyTranslating,
}));
