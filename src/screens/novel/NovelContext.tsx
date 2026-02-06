import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useNovel } from '@hooks/persisted';
import { RouteProp } from '@react-navigation/native';
import { ReaderStackParamList } from '@navigators/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeviceOrientation } from '@hooks/index';
import { NovelInfo } from '@database/types';

type NovelContextType = ReturnType<typeof useNovel> & {
  navigationBarHeight: number;
  statusBarHeight: number;
  chapterTextCache: Map<number, string | Promise<string>>;
};

const defaultValue = {} as NovelContextType;

const NovelContext = createContext<NovelContextType>(defaultValue);

export function NovelContextProvider({
  children,

  route,
}: {
  children: React.JSX.Element;

  route:
    | RouteProp<ReaderStackParamList, 'Novel'>
    | RouteProp<ReaderStackParamList, 'Chapter'>;
}) {
  const { path, pluginId } =
    'novel' in route.params ? route.params.novel : route.params;

  const novelHookContent = useNovel(
    'id' in route.params ? (route.params as NovelInfo) : path,
    pluginId,
  );

  const { bottom, top } = useSafeAreaInsets();
  const orientation = useDeviceOrientation();
  const NavigationBarHeight = useRef(bottom);
  const StatusBarHeight = useRef(top);
  const chapterTextCache = useRef<Map<number, string | Promise<string>>>(
    new Map(),
  );

  if (bottom < NavigationBarHeight.current && orientation === 'landscape') {
    NavigationBarHeight.current = bottom;
  } else if (bottom > NavigationBarHeight.current) {
    NavigationBarHeight.current = bottom;
  }
  if (top > StatusBarHeight.current) {
    StatusBarHeight.current = top;
  }
  const contextValue = useMemo(
    () => ({
      ...novelHookContent,
      navigationBarHeight: NavigationBarHeight.current,
      statusBarHeight: StatusBarHeight.current,
      chapterTextCache: chapterTextCache.current,
    }),
    [novelHookContent],
  );
  return (
    <NovelContext.Provider value={contextValue}>
      {children}
    </NovelContext.Provider>
  );
}

export const useNovelContext = () => {
  const context = useContext(NovelContext);
  return context;
};
