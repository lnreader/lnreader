import React, { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import WebView from 'react-native-webview';
import { NovelInfo, ChapterInfo } from '@database/types';
import { ChapterReaderSettings } from '@hooks/persisted/useSettings';
import {
  showTTSNotification,
  updateTTSNotification,
  updateTTSPlaybackState,
  updateTTSProgress,
  dismissTTSNotification,
  NativeTTSMediaControl,
} from '@utils/ttsNotification';

export type WebViewPostEvent = {
  type: string;
  data?: unknown;
  autoStartTTS?: boolean;
  index?: number;
  total?: number;
};

export const areTTSSettingsEqual = (
  a: ChapterReaderSettings['tts'],
  b: ChapterReaderSettings['tts'],
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.rate === b.rate &&
    a.pitch === b.pitch &&
    a.autoPageAdvance === b.autoPageAdvance &&
    a.scrollToTop === b.scrollToTop &&
    a.voice?.identifier === b.voice?.identifier
  );
};
interface UseTTSOptions {
  webViewRef: React.RefObject<WebView<{}> | null>;
  isTTSReadingRef: React.MutableRefObject<boolean>;
  novel: NovelInfo;
  chapter: ChapterInfo;
  readerSettingsRef: React.MutableRefObject<ChapterReaderSettings>;
  onUserInteraction: () => void;
}

export function useTTS(options: UseTTSOptions): {
  handleTTSEvent: (event: WebViewPostEvent) => boolean;
  onTTSSettingsChanged: () => void;
  autoStartTTSRef: React.MutableRefObject<boolean>;
} {
  const {
    webViewRef,
    isTTSReadingRef,
    novel,
    chapter,
    readerSettingsRef,
    onUserInteraction,
  } = options;

  const ttsQueueRef = useRef<string[]>([]);
  const ttsQueueIndexRef = useRef<number>(0);
  const autoStartTTSRef = useRef<boolean>(false);
  const appStateRef = useRef<string>(AppState.currentState);

  const speakText = useCallback(
    (text: string) => {
      Speech.speak(text, {
        onDone() {
          onUserInteraction();
          const isBackground =
            appStateRef.current === 'background' ||
            appStateRef.current === 'inactive';

          if (
            isBackground &&
            ttsQueueRef.current.length > 0 &&
            ttsQueueIndexRef.current + 1 < ttsQueueRef.current.length
          ) {
            const nextIndex = ttsQueueIndexRef.current + 1;
            const nextText = ttsQueueRef.current[nextIndex];
            if (nextText) {
              ttsQueueIndexRef.current = nextIndex;
              speakText(nextText);
              return;
            }
          }

          if (isBackground) {
            isTTSReadingRef.current = false;
            dismissTTSNotification();
            webViewRef.current?.injectJavaScript('tts.stop?.()');
            return;
          }

          webViewRef.current?.injectJavaScript('tts.next?.()');
        },
        voice: readerSettingsRef.current.tts?.voice?.identifier,
        pitch: readerSettingsRef.current.tts?.pitch || 1,
        rate: readerSettingsRef.current.tts?.rate || 1,
      });
    },
    [webViewRef, isTTSReadingRef, readerSettingsRef, onUserInteraction],
  );

  const handleTTSEvent = useCallback(
    (event: WebViewPostEvent): boolean => {
      if (event.autoStartTTS) {
        autoStartTTSRef.current = true;
      }
      switch (event.type) {
        case 'tts-queue': {
          const payload = event.data as
            | { queue?: unknown; startIndex?: unknown }
            | undefined;
          const queue = Array.isArray(payload?.queue)
            ? payload?.queue.filter(
              (item): item is string =>
                typeof item === 'string' && item.trim().length > 0,
            )
            : [];
          ttsQueueRef.current = queue;
          if (typeof payload?.startIndex === 'number') {
            ttsQueueIndexRef.current = payload.startIndex;
          } else {
            ttsQueueIndexRef.current = 0;
          }
          return true;
        }
        case 'speak':
          if (event.data && typeof event.data === 'string') {
            if (typeof event.index === 'number') {
              ttsQueueIndexRef.current = event.index;
            }
            if (!isTTSReadingRef.current) {
              isTTSReadingRef.current = true;
              showTTSNotification({
                novelName: novel?.name || 'Unknown',
                chapterName: chapter.name,
                coverUri: novel?.cover || '',
                isPlaying: true,
              });
            } else {
              updateTTSNotification({
                novelName: novel?.name || 'Unknown',
                chapterName: chapter.name,
                coverUri: novel?.cover || '',
                isPlaying: true,
              });
            }
            if (
              typeof event.index === 'number' &&
              typeof event.total === 'number' &&
              event.total > 0
            ) {
              updateTTSProgress(event.index, event.total);
            }
            speakText(event.data);
          } else {
            webViewRef.current?.injectJavaScript('tts.next?.()');
          }
          return true;
        case 'pause-speak':
          Speech.stop();
          return true;
        case 'stop-speak':
          Speech.stop();
          if (!autoStartTTSRef.current) {
            isTTSReadingRef.current = false;
            ttsQueueRef.current = [];
            ttsQueueIndexRef.current = 0;
            dismissTTSNotification();
          }
          return true;
        case 'tts-state':
          if (event.data && typeof event.data === 'object') {
            const data = event.data as { isReading?: boolean };
            const isReading = data.isReading === true;
            onUserInteraction();
            isTTSReadingRef.current = isReading;
            updateTTSPlaybackState(isReading);
          }
          return true;
        default:
          return false;
      }
    },
    [novel, chapter, webViewRef, isTTSReadingRef, onUserInteraction, speakText],
  );

  const onTTSSettingsChanged = useCallback(() => {
    Speech.stop();
    webViewRef.current?.injectJavaScript(`
      if (window.tts && tts.reading) {
        const currentElement = tts.currentElement;
        const wasReading = tts.reading;
        tts.stop();
        if (wasReading) {
          setTimeout(() => {
            tts.start(currentElement);
          }, 100);
        }
      }
    `);
  }, [webViewRef]);

  // Media control listeners
  useEffect(() => {
    const playListener = NativeTTSMediaControl.addListener('TTSPlay', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && !tts.reading) { tts.resume(); }
      `);
    });
    const pauseListener = NativeTTSMediaControl.addListener('TTSPause', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && tts.reading) { tts.pause(); }
      `);
    });
    const stopListener = NativeTTSMediaControl.addListener('TTSStop', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts) { tts.stop(); }
      `);
    });
    const rewindListener = NativeTTSMediaControl.addListener('TTSRewind', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && tts.started) { tts.rewind(); }
      `);
    });
    const prevListener = NativeTTSMediaControl.addListener('TTSPrev', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && window.reader && window.reader.prevChapter) {
          window.reader.post({ type: 'prev', autoStartTTS: true });
        }
      `);
    });
    const nextListener = NativeTTSMediaControl.addListener('TTSNext', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && window.reader && window.reader.nextChapter) {
          window.reader.post({ type: 'next', autoStartTTS: true });
        }
      `);
    });
    const seekToListener = NativeTTSMediaControl.addListener(
      'TTSSeekTo',
      (event: { position: number }) => {
        const position = event.position;
        webViewRef.current?.injectJavaScript(`
          if (window.tts && tts.started) { tts.seekTo(${position}); }
        `);
      },
    );
    return () => {
      playListener.remove();
      pauseListener.remove();
      stopListener.remove();
      rewindListener.remove();
      prevListener.remove();
      nextListener.remove();
      seekToListener.remove();
    };
  }, [webViewRef]);

  // TTS notification update
  useEffect(() => {
    if (isTTSReadingRef.current) {
      updateTTSNotification({
        novelName: novel?.name || 'Unknown',
        chapterName: chapter.name,
        coverUri: novel?.cover || '',
        isPlaying: isTTSReadingRef.current,
      });
    }
  }, [novel?.name, novel?.cover, chapter.name, isTTSReadingRef]);

  // TTS notification dismiss on unmount
  useEffect(() => {
    return () => {
      dismissTTSNotification();
    };
  }, []);

  // AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      appStateRef.current = nextState;
      if (nextState === 'active' && isTTSReadingRef.current) {
        const index = ttsQueueIndexRef.current;
        webViewRef.current?.injectJavaScript(`
          if (window.tts && window.tts.allReadableElements) {
            const idx = ${index};
            if (idx < tts.allReadableElements.length) {
              tts.elementsRead = idx;
              tts.currentElement = tts.allReadableElements[idx];
              tts.prevElement = null;
              tts.started = true;
              tts.reading = true;
              tts.scrollToElement(tts.currentElement);
              tts.currentElement.classList.add('highlight');
            }
          }
        `);
      }
    });

    return () => subscription.remove();
  }, [webViewRef, isTTSReadingRef]);

  return {
    handleTTSEvent,
    onTTSSettingsChanged,
    autoStartTTSRef,
  };
}
