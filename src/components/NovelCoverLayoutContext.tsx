import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react';

import { useLibrarySettings } from '@hooks/persisted/useSettings';
import {
  MEDIUM_MIN_WIDTH,
  useWindowLayout,
} from '@hooks/common/useWindowLayout';
import { DisplayModes } from '@screens/library/constants/constants';
import { COVER_ASPECT } from './NovelCoverImage';

export const GRID_PADDING = 16;
export const GRID_SPACING = 12;
const MIN_CELL_WIDTH = 140;
export const GLOBAL_SEARCH_COVER_WIDTH = 112;

export interface NovelCoverLayout {
  coverHeight: number;
  coverWidth: number;
  displayMode: DisplayModes;
  numColumns: number;
  showDownloadBadges: boolean;
  showUnreadBadges: boolean;
}

const NovelCoverLayoutContext = createContext<NovelCoverLayout | null>(null);

const columnsFor = (width: number, novelsPerRow: number) => {
  if (width < MEDIUM_MIN_WIDTH) {
    return Math.max(1, novelsPerRow);
  }
  // Wide windows fit as many columns as keep covers legible.
  const fit = Math.floor(
    (width - GRID_PADDING * 2 + GRID_SPACING) / (MIN_CELL_WIDTH + GRID_SPACING),
  );
  return Math.max(novelsPerRow, fit);
};

export const useNovelCoverLayoutValue = (
  globalSearch = false,
  availableWidth?: number,
): NovelCoverLayout => {
  const {
    displayMode = DisplayModes.Comfortable,
    novelsPerRow = 3,
    showDownloadBadges = true,
    showUnreadBadges = true,
  } = useLibrarySettings();
  const window = useWindowLayout();
  const width = availableWidth ?? window.width;

  return useMemo(() => {
    // Global search rows keep three covers per screen whatever the library shows.
    const numColumns = globalSearch
      ? columnsFor(width, 3)
      : displayMode === DisplayModes.List
      ? 1
      : columnsFor(width, novelsPerRow);
    const coverWidth = Math.floor(
      (width - GRID_PADDING * 2 - GRID_SPACING * (numColumns - 1)) / numColumns,
    );

    return {
      coverHeight: Math.round(coverWidth * COVER_ASPECT),
      coverWidth,
      displayMode,
      numColumns,
      showDownloadBadges,
      showUnreadBadges,
    };
  }, [
    displayMode,
    globalSearch,
    novelsPerRow,
    showDownloadBadges,
    showUnreadBadges,
    width,
  ]);
};

export const NovelCoverLayoutProvider = ({
  children,
  value,
}: PropsWithChildren<{ value: NovelCoverLayout }>) => (
  <NovelCoverLayoutContext.Provider value={value}>
    {children}
  </NovelCoverLayoutContext.Provider>
);

export const useNovelCoverLayout = () => {
  const layout = useContext(NovelCoverLayoutContext);

  if (!layout) {
    throw new Error(
      'NovelCover must be rendered inside NovelCoverLayoutProvider',
    );
  }

  return layout;
};
