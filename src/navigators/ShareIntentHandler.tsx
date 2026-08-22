import { useCallback, useEffect } from 'react';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useEventListener } from 'expo';

import NativeShareReceiver from '@modules/native-share-receiver';
import { resolveSharedUrl } from '@services/share/resolveSharedUrl';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// The container resolves its initial state asynchronously (linking), so a
// share arriving before navigationRef.isReady() would otherwise be dropped.
// Queue it here; Main.tsx flushes once NavigationContainer's onReady fires.
let pendingShare: string | null = null;

const dispatchSharedText = (text: string) => {
  const result = resolveSharedUrl(text);
  if (!result) {
    return;
  }
  if (!navigationRef.isReady()) {
    pendingShare = text;
    return;
  }
  if (result.kind === 'novel') {
    // Novel screen bootstraps itself via fetchNovel(pluginId, path);
    // name/cover params are not consumed by the novel store (verified in
    // NovelContextProvider: only path/pluginId are read).
    navigationRef.navigate('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        path: result.path,
        pluginId: result.pluginId,
        cover: null,
      },
    });
  } else {
    navigationRef.navigate('GlobalSearchScreen', {
      searchText: result.searchText,
    });
  }
};

export const flushPendingShare = () => {
  if (pendingShare === null || !navigationRef.isReady()) {
    return;
  }
  const text = pendingShare;
  pendingShare = null;
  dispatchSharedText(text);
};

const ShareIntentHandler = () => {
  const handleSharedText = useCallback((text: string) => {
    dispatchSharedText(text);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve(NativeShareReceiver.getInitialSharedText())
      .then(text => {
        if (active && text) {
          handleSharedText(text);
        }
      })
      .catch(() => {
        // Nothing to act on if the initial intent cannot be read.
      });
    return () => {
      active = false;
    };
  }, [handleSharedText]);

  useEventListener(NativeShareReceiver, 'SharedText', ({ text }) => {
    if (text) {
      handleSharedText(text);
    }
  });

  return null;
};

export default ShareIntentHandler;
