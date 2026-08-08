import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { RouteProp } from '@react-navigation/native';
import { useStore } from 'zustand';
import { ReaderStackParamList } from '@navigators/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { useAppSettings } from '@hooks/persisted';
import {
  NovelStoreActions,
  NovelStoreApi,
  NovelStoreData,
  NovelStoreState,
} from '@hooks/persisted/useNovel/store/novelStore.types';
import { NovelInfo } from '@database/types';
import { createStore } from '@hooks/persisted/useNovel/store/createStore';

type Props = {
  children: React.ReactNode;
  route:
    | RouteProp<ReaderStackParamList, 'Novel'>
    | RouteProp<ReaderStackParamList, 'Chapter'>;
};

type NovelLayout = {
  navigationBarHeight: number;
  statusBarHeight: number;
};

const NovelStoreContext = createContext<NovelStoreApi | null>(null);
const NovelLayoutContext = createContext<NovelLayout | null>(null);

export function NovelContextProvider({ children, route }: Props) {
  const params = (route.params ?? {}) as {
    novel?: { path: string; pluginId: string };
    path?: string;
    pluginId?: string;
    id?: number;
  };
  const initialNovel =
    params.id !== undefined ? (params as unknown as NovelInfo) : undefined;

  // The ReaderStack's route can carry Chapter-shaped params ({ novel,
  // chapter }) or a stale first-mount params object (ReaderStack.tsx falls
  // back to `useRef`'d params while a transition leaves `route.params`
  // momentarily nullish). Guard both the key and the value: a malformed
  // params object must degrade to the path-based bootstrap instead of
  // throwing while reading `.path` off `undefined` (measured: "Cannot read
  // property 'path' of undefined" when opening a novel from the library
  // after a plugin open).
  const { path = '', pluginId = '' } = params.novel ?? params;

  const { switchNovelToLibrary } = useLibraryContext();
  const { defaultChapterSort } = useAppSettings();

  const novelStore = useMemo(
    () =>
      createStore({
        path,
        pluginId,
        novel: initialNovel,
        defaultChapterSort,
        switchNovelToLibrary,
      }),
    [defaultChapterSort, initialNovel, path, pluginId, switchNovelToLibrary],
  );

  useEffect(() => {
    const actions = novelStore.getState().actions;
    if (!actions.bootstrapNovelSync()) {
      void actions.bootstrapNovel();
    }
  }, [novelStore]);

  const gcHandleRef = useRef<{ cancel: () => void } | null>(null);
  useEffect(() => {
    // A new novel screen mounted; drop any reclaim still pending from the
    // previous one so the collection cannot pause this screen's bootstrap.
    gcHandleRef.current?.cancel();
    gcHandleRef.current = null;
    return () => {
      // The store (full chapter list) and the fetch/parse garbage from an
      // uncached bootstrap are released here. Hermes' concurrent GC only runs
      // on allocation pressure, so without a nudge the dead objects sit in the
      // heap and the heap cap ratchets up with every novel opened — the GC
      // cost of scrolling then grows until the app is restarted (measured:
      // +5 MB of collectible garbage per uncached open; forced GC dropped the
      // cap 54.5 MB -> 50.3 MB). Reclaim after the pop transition finishes
      // (~300 ms) so the collection cannot hitch the animation.
      const timer = setTimeout(() => globalThis.gc?.(), 600);
      gcHandleRef.current = { cancel: () => clearTimeout(timer) };
    };
  }, []);

  const { bottom, top } = useSafeAreaInsets();

  const layoutValue = useMemo(
    () => ({
      navigationBarHeight: bottom,
      statusBarHeight: top,
    }),
    [bottom, top],
  );
  return (
    <NovelStoreContext.Provider value={novelStore}>
      <NovelLayoutContext.Provider value={layoutValue}>
        {children}
      </NovelLayoutContext.Provider>
    </NovelStoreContext.Provider>
  );
}

function useNovelStoreApi() {
  const store = useContext(NovelStoreContext);

  if (!store) {
    throw new Error('useNovelStore must be used inside NovelContextProvider');
  }

  return store;
}

export function useNovelStore<T>(selector: (state: NovelStoreState) => T): T {
  const store = useNovelStoreApi();
  return useStore(store, selector);
}

export function useNovelState<T>(selector: (state: NovelStoreData) => T): T {
  return useNovelStore(state => selector(state));
}

export function useNovelValue<K extends keyof NovelStoreData>(
  key: K,
): NovelStoreData[K] {
  return useNovelStore(state => state[key]);
}

export function useNovelActions(): NovelStoreActions {
  return useNovelStore(state => state.actions);
}

export function useNovelAction<K extends keyof NovelStoreActions>(
  key: K,
): NovelStoreActions[K] {
  return useNovelStore(state => state.actions[key]);
}

export function useNovelLayout() {
  const context = useContext(NovelLayoutContext);

  if (!context) {
    throw new Error('useNovelLayout must be used inside NovelContextProvider');
  }

  return context;
}
