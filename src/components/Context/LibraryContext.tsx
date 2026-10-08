import React, { createContext, useContext } from 'react';
import {
  useLibrary,
  UseLibraryReturnType,
} from '@screens/library/hooks/useLibrary';
import { useLibrarySettings } from '@hooks/persisted';
import SetCategoriesModal from '@screens/novel/components/SetCategoriesModal';
import OverlayHost from '../OverlayHost/OverlayHost';

// type Library = Category & { novels: LibraryNovelInfo[] };

type LibraryContextType = UseLibraryReturnType & {
  settings: ReturnType<typeof useLibrarySettings>;
};

const EMPTY_NOVEL_IDS: number[] = [];

const defaultValue = {} as LibraryContextType;
const LibraryContext = createContext<LibraryContextType>(defaultValue);

export function LibraryContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const useLibraryParams = useLibrary();
  const settings = useLibrarySettings();
  const {
    pendingLibraryAddition,
    cancelPendingLibraryAddition,
    confirmPendingLibraryAddition,
  } = useLibraryParams;

  return (
    <>
      <LibraryContext.Provider value={{ ...useLibraryParams, settings }}>
        {children}
      </LibraryContext.Provider>
      {pendingLibraryAddition ? (
        <OverlayHost>
          <SetCategoriesModal
            novelIds={EMPTY_NOVEL_IDS}
            initialCategoryIds={pendingLibraryAddition.initialCategoryIds}
            closeModal={cancelPendingLibraryAddition}
            onSubmit={confirmPendingLibraryAddition}
            visible
          />
        </OverlayHost>
      ) : null}
    </>
  );
}

export const useLibraryContext = (): LibraryContextType => {
  return useContext(LibraryContext);
};
