import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  useLibrary,
  UseLibraryReturnType,
} from '@screens/library/hooks/useLibrary';
import { useLibrarySettings } from '@hooks/persisted';
import SetCategoriesModal from '@screens/novel/components/SetCategoriesModal';

// type Library = Category & { novels: LibraryNovelInfo[] };

type LibraryContextType = UseLibraryReturnType & {
  settings: ReturnType<typeof useLibrarySettings>;
};

const EMPTY_NOVEL_IDS: number[] = [];

/**
 * The library actions most screens need, split from the data so that calling
 * one does not subscribe the caller to every library reload. Their identity
 * never changes: each forwards to the latest implementation.
 */
export type LibraryActions = Pick<
  UseLibraryReturnType,
  'refetchLibrary' | 'refreshCategories' | 'switchNovelToLibrary'
>;

const defaultValue = {} as LibraryContextType;
const LibraryContext = createContext<LibraryContextType>(defaultValue);
const LibraryActionsContext = createContext<LibraryActions>(
  {} as LibraryActions,
);

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

  const latestLibrary = useRef(useLibraryParams);
  // A layout effect so the ref is current before any passive effect in the
  // tree can call an action.
  useLayoutEffect(() => {
    latestLibrary.current = useLibraryParams;
  });

  const refetchLibrary = useCallback(
    () => latestLibrary.current.refetchLibrary(),
    [],
  );
  const refreshCategories = useCallback(
    () => latestLibrary.current.refreshCategories(),
    [],
  );
  const switchNovelToLibrary = useCallback(
    (novelPath: string, pluginId: string) =>
      latestLibrary.current.switchNovelToLibrary(novelPath, pluginId),
    [],
  );
  const actions = useMemo<LibraryActions>(
    () => ({ refetchLibrary, refreshCategories, switchNovelToLibrary }),
    [refetchLibrary, refreshCategories, switchNovelToLibrary],
  );

  return (
    <>
      <LibraryActionsContext.Provider value={actions}>
        <LibraryContext.Provider value={{ ...useLibraryParams, settings }}>
          {children}
        </LibraryContext.Provider>
      </LibraryActionsContext.Provider>
      {pendingLibraryAddition ? (
        <SetCategoriesModal
          novelIds={EMPTY_NOVEL_IDS}
          initialCategoryIds={pendingLibraryAddition.initialCategoryIds}
          closeModal={cancelPendingLibraryAddition}
          onSubmit={confirmPendingLibraryAddition}
          visible
        />
      ) : null}
    </>
  );
}

/**
 * Library data plus actions. Re-renders on every library reload – use
 * `useLibraryActions` when only the actions are needed.
 */
export const useLibraryContext = (): LibraryContextType => {
  return useContext(LibraryContext);
};

export const useLibraryActions = (): LibraryActions => {
  return useContext(LibraryActionsContext);
};
