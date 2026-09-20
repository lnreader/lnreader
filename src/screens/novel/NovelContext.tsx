import React, { createContext, useContext, useMemo, useRef } from 'react';
import { RouteProp } from '@react-navigation/native';
import { useStore } from 'zustand';
import { ReaderStackParamList } from '@navigators/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeviceOrientation } from '@hooks/index';
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
  const storeKey = `${pluginId}:${path}`;

  const { switchNovelToLibrary } = useLibraryContext();
  const { defaultChapterSort, showPaginatedChaptersAsOneList } =
    useAppSettings();

  const switchNovelToLibraryRef = useRef(switchNovelToLibrary);

  const storeRef = useRef<{
    key: string;
    store: NovelStoreApi;
  } | null>(null);
  const queriedNovelRef = useRef<boolean>(false);

  if (storeRef.current?.key !== storeKey) {
    queriedNovelRef.current = false;

    storeRef.current = {
      key: storeKey,
      store: createStore({
        path,
        pluginId,
        novel: initialNovel,
        defaultChapterSort,
        showPaginatedChaptersAsOneList,
        switchNovelToLibrary: switchNovelToLibraryRef.current,
      }),
    };
  }
  const novelStore = storeRef.current.store;

  const { bottom, top } = useSafeAreaInsets();
  const orientation = useDeviceOrientation();

  const navigationBarHeightRef = useRef(bottom);
  const statusBarHeightRef = useRef(top);

  if (bottom < navigationBarHeightRef.current && orientation === 'landscape') {
    navigationBarHeightRef.current = bottom;
  } else if (bottom > navigationBarHeightRef.current) {
    navigationBarHeightRef.current = bottom;
  }

  if (top > statusBarHeightRef.current) {
    statusBarHeightRef.current = top;
  }

  const layoutValue = useMemo(
    () => ({
      navigationBarHeight: navigationBarHeightRef.current,
      statusBarHeight: statusBarHeightRef.current,
    }),
    [],
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
