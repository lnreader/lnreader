import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react';
import { useWindowDimensions } from 'react-native';

import { useDeviceOrientation } from '@hooks';
import { useLibrarySettings } from '@hooks/persisted';
import { DisplayModes } from '@screens/library/constants/constants';

export interface NovelCoverLayout {
  coverHeight: number;
  coverWidth?: number;
  displayMode: DisplayModes;
  numColumns: number;
  showDownloadBadges: boolean;
  showUnreadBadges: boolean;
}

const NovelCoverLayoutContext = createContext<NovelCoverLayout | null>(null);

export const useNovelCoverLayoutValue = (
  globalSearch = false,
): NovelCoverLayout => {
  const {
    displayMode = DisplayModes.Comfortable,
    novelsPerRow = 3,
    showDownloadBadges = true,
    showUnreadBadges = true,
  } = useLibrarySettings();
  const { width } = useWindowDimensions();
  const orientation = useDeviceOrientation();

  return useMemo(() => {
    const numColumns = globalSearch
      ? 3
      : orientation === 'landscape'
      ? 6
      : displayMode === DisplayModes.List
      ? 1
      : novelsPerRow;
    const coverWidth = globalSearch ? width / 3 - 16 : undefined;
    const coverHeight = (coverWidth ?? width / numColumns) * (4 / 3);

    return {
      coverHeight,
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
    orientation,
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
