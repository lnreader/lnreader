import React from 'react';

const defaultLibraryContext = {
  library: [],
  categories: [],
  isLoading: false,
  setCategories: jest.fn(),
  refreshCategories: jest.fn().mockResolvedValue(undefined),
  setLibrary: jest.fn(),
  novelInLibrary: jest.fn(() => false),
  switchNovelToLibrary: jest.fn().mockResolvedValue(true),
  pendingLibraryAddition: undefined,
  cancelPendingLibraryAddition: jest.fn(),
  confirmPendingLibraryAddition: jest.fn().mockResolvedValue(undefined),
  refetchLibrary: jest.fn(),
  setLibrarySearchText: jest.fn(),
  settings: {
    sortOrder: undefined,
    filter: undefined,
    showDownloadBadges: false,
    showUnreadBadges: false,
    showNumberOfNovels: false,
    displayMode: undefined,
    novelsPerRow: undefined,
    incognitoMode: false,
    downloadedOnlyMode: false,
  },
};

export const LibraryContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <>{children}</>;
};

export const useLibraryContext = jest.fn(() => defaultLibraryContext);
export const useLibraryActions = jest.fn(() => ({
  refetchLibrary: defaultLibraryContext.refetchLibrary,
  refreshCategories: defaultLibraryContext.refreshCategories,
  switchNovelToLibrary: defaultLibraryContext.switchNovelToLibrary,
}));
