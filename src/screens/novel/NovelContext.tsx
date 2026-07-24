import React, { createContext, useContext, useEffect, useMemo } from 'react';
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
  const initialNovel =
    'id' in route.params ? (route.params as NovelInfo) : undefined;

  const { path, pluginId } =
    'novel' in route.params ? route.params.novel : route.params;

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
