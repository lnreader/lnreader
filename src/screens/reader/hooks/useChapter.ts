import {
  getChapter as getDbChapter,
  getNextChapter,
  getPrevChapter,
} from '@database/queries/ChapterQueries';
import { insertHistory } from '@database/queries/HistoryQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import {
  useChapterGeneralSettings,
  useLibrarySettings,
  useTrackedNovel,
  useTracker,
} from '@hooks/persisted';
import { fetchChapter } from '@services/plugin/fetch';
import { NOVEL_STORAGE } from '@utils/Storages';
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { sanitizeChapterText } from '../utils/sanitizeChapterText';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import WebView from 'react-native-webview';
import { useFullscreenMode } from '@hooks';
import { Dimensions, NativeEventEmitter } from 'react-native';
import * as Speech from 'expo-speech';
import { defaultTo } from 'lodash-es';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import NativeVolumeButtonListener from '@specs/NativeVolumeButtonListener';
import NativeFile from '@specs/NativeFile';
import { useNovelContext } from '@screens/novel/NovelContext';

const emmiter = new NativeEventEmitter(NativeVolumeButtonListener);

export default function useChapter(
  webViewRef: RefObject<WebView | null>,
  initialChapter: ChapterInfo,
  novel: NovelInfo,
) {
  const {
    setLastRead,
    markChapterRead,
    updateChapterProgress,
    chapterTextCache,
  } = useNovelContext();
  const [hidden, setHidden] = useState(true);
  const [chapter, setChapter] = useState(initialChapter);
  const [loading, setLoading] = useState(true);
  const [chapterText, setChapterText] = useState('');

  const [[nextChapter, prevChapter], setAdjacentChapter] = useState<
    ChapterInfo[] | undefined[]
  >([]);
  const { autoScroll, autoScrollInterval, autoScrollOffset, useVolumeButtons, volumeButtonsOffset } =
    useChapterGeneralSettings();
  const { incognitoMode } = useLibrarySettings();
  const [error, setError] = useState<string>();
  const { tracker } = useTracker();
  const { trackedNovel, updateAllTrackedNovels } = useTrackedNovel(novel.id);
  const { setImmersiveMode, showStatusAndNavBar } = useFullscreenMode();

  const connectVolumeButton = useCallback(() => {
    const offset = defaultTo(volumeButtonsOffset, Math.round(Dimensions.get('window').height * 0.75));
    emmiter.addListener('VolumeUp', () => {
      webViewRef.current?.injectJavaScript(`(()=>{
        window.scrollBy({top: -${offset}, behavior: 'smooth'})
      })()`);
    });
    emmiter.addListener('VolumeDown', () => {
      webViewRef.current?.injectJavaScript(`(()=>{
        window.scrollBy({top: ${offset}, behavior: 'smooth'})
      })()`);
    });
  }, [webViewRef, volumeButtonsOffset]);

  useEffect(() => {
    if (useVolumeButtons) {
      connectVolumeButton();
    } else {
      emmiter.removeAllListeners('VolumeUp');
      emmiter.removeAllListeners('VolumeDown');
      // this is just for sure, without it app still works properly
    }

    return () => {
      emmiter.removeAllListeners('VolumeUp');
      emmiter.removeAllListeners('VolumeDown');
      Speech.stop();
    };
  }, [useVolumeButtons, chapter, connectVolumeButton]);

  const loadChapterText = useCallback(
    async (id: number, path: string) => {
      const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${chapter.novelId}/${id}/index.html`;
      let text = '';
      if (NativeFile.exists(filePath)) {
        text = NativeFile.readFile(filePath);
      } else {
        await fetchChapter(novel.pluginId, path)
          .then(res => {
            text = res;
          })
          .catch(e => setError(e.message));
      }
      return text;
    },
    [chapter.novelId, novel.pluginId],
  );

  const getChapter = useCallback(
    async (navChapter?: ChapterInfo) => {
      try {
        const chap = navChapter ?? chapter;
        const cachedText = chapterTextCache.get(chap.id);
        const text = cachedText ?? loadChapterText(chap.id, chap.path);
        const [nextChap, prevChap, awaitedText] = await Promise.all([
          getNextChapter(chap.novelId, chap.position!, chap.page),
          getPrevChapter(chap.novelId, chap.position!, chap.page),
          text,
        ]);
        if (nextChap && !chapterTextCache.get(nextChap.id)) {
          chapterTextCache.set(
            nextChap.id,
            loadChapterText(nextChap.id, nextChap.path),
          );
        }
        if (!cachedText) {
          chapterTextCache.set(chap.id, text);
        }
        setChapter(chap);
        setChapterText(
          sanitizeChapterText(
            novel.pluginId,
            novel.name,
            chap.name,
            awaitedText,
          ),
        );
        setAdjacentChapter([nextChap!, prevChap!]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [
      chapter,
      chapterTextCache,
      loadChapterText,
      setChapter,
      setChapterText,
      novel.pluginId,
      novel.name,
      setLoading,
    ],
  );

  const scrollInterval = useRef<NodeJS.Timeout>(null);
  useEffect(() => {
    if (autoScroll) {
      scrollInterval.current = setInterval(() => {
        webViewRef.current?.injectJavaScript(`(()=>{
          window.scrollBy({top:${defaultTo(
            autoScrollOffset,
            Dimensions.get('window').height,
          )},behavior:'smooth'})
        })()`);
      }, autoScrollInterval * 1000);
    } else {
      if (scrollInterval.current) {
        clearInterval(scrollInterval.current);
      }
    }

    return () => {
      if (scrollInterval.current) {
        clearInterval(scrollInterval.current);
      }
    };
  }, [autoScroll, autoScrollInterval, autoScrollOffset, webViewRef]);

  const updateTracker = useCallback(() => {
    const chapterNumber = parseChapterNumber(novel.name, chapter.name);
    if (tracker && trackedNovel && chapterNumber > trackedNovel.progress) {
      updateAllTrackedNovels({ progress: chapterNumber });
    }
  }, [chapter.name, novel.name, trackedNovel, tracker, updateAllTrackedNovels]);

  const saveProgress = useCallback(
    (percentage: number) => {
      if (!incognitoMode) {
        updateChapterProgress(chapter.id, percentage > 100 ? 100 : percentage);

        if (percentage >= 97) {
          // a relative number
          markChapterRead(chapter.id);
          updateTracker();
        }
      }
    },
    [
      chapter.id,
      incognitoMode,
      markChapterRead,
      updateChapterProgress,
      updateTracker,
    ],
  );

  const hideHeader = useCallback(() => {
    if (!hidden) {
      webViewRef.current?.injectJavaScript('reader.hidden.val = true');
      setImmersiveMode();
    } else {
      webViewRef.current?.injectJavaScript('reader.hidden.val = false');
      showStatusAndNavBar();
    }
    setHidden(!hidden);
  }, [hidden, setImmersiveMode, showStatusAndNavBar, webViewRef]);

  const navigateChapter = useCallback(
    (position: 'NEXT' | 'PREV') => {
      let nextNavChapter;
      if (position === 'NEXT') {
        nextNavChapter = nextChapter;
      } else if (position === 'PREV') {
        nextNavChapter = prevChapter;
      } else {
        return;
      }
      if (nextNavChapter) {
        // setLoading(true);

        getChapter(nextNavChapter);
      } else {
        showToast(
          position === 'NEXT'
            ? getString('readerScreen.noNextChapter')
            : getString('readerScreen.noPreviousChapter'),
        );
      }
    },
    [getChapter, nextChapter, prevChapter],
  );

  useEffect(() => {
    if (!incognitoMode) {
      insertHistory(chapter.id);
      getDbChapter(chapter.id).then(result => result && setLastRead(result));
    }

    return () => {
      if (!incognitoMode) {
        getDbChapter(chapter.id).then(result => result && setLastRead(result));
      }
    };
  }, [incognitoMode, setLastRead, setLoading, chapter.id]);

  useEffect(() => {
    if (!chapter || !chapterText) {
      getChapter();
    }
  }, [chapter, chapterText, getChapter]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError('');
    getChapter();
  }, [getChapter]);

  return useMemo(
    () => ({
      hidden,
      chapter,
      nextChapter,
      prevChapter,
      error,
      loading,
      chapterText,
      setHidden,
      saveProgress,
      hideHeader,
      navigateChapter,
      refetch,
      setChapter,
      setLoading,
      getChapter,
    }),
    [
      hidden,
      chapter,
      nextChapter,
      prevChapter,
      error,
      loading,
      chapterText,
      setHidden,
      saveProgress,
      hideHeader,
      navigateChapter,
      refetch,
      setChapter,
      setLoading,
      getChapter,
    ],
  );
}
