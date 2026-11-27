import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

import { ChapterScreenProps } from '@navigators/types';
import { resolveNovelLink } from '@services/share/resolveSharedUrl';

type CurrentNovel = { pluginId: string; path: string };

/**
 * Returns a handler that opens a novel link from the chapter in the app. The
 * handler returns true when it handled the URL, so the WebView must not load it.
 */
export default function useNovelLinkNavigation(novel: CurrentNovel) {
  const navigation = useNavigation<ChapterScreenProps['navigation']>();
  const { pluginId, path } = novel;

  return useCallback(
    (url: string): boolean => {
      const link = resolveNovelLink(url);
      if (!link) {
        return false;
      }
      // A second tap can arrive before the novel screen covers the reader.
      // Pushing again would stack a copy, so Back would need two presses.
      if (!navigation.isFocused()) {
        return true;
      }
      const params = { name: '', cover: null, ...link };
      if (link.pluginId === pluginId && link.path === path) {
        navigation.push('Novel', params);
      } else {
        // NovelContextProvider wraps the whole ReaderStack, so another novel
        // needs its own stack; going back then returns to this chapter.
        navigation.push('ReaderStack', { screen: 'Novel', params });
      }
      return true;
    },
    [navigation, path, pluginId],
  );
}
