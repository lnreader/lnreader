import React, { useEffect, useRef } from 'react';
import { AppState, NativeEventEmitter, NativeModules } from 'react-native';
import WebView from 'react-native-webview';

import { MMKVStorage } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  CHAPTER_READER_SETTINGS,
  useChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import * as Speech from 'expo-speech';
import {
  updateTTSNotification,
  dismissTTSNotification,
  ttsMediaEmitter,
  showTTSNotification,
  updateTTSProgress,
  updateTTSPlaybackState,
} from '@utils/ttsNotification';
import { ChapterInfo, NovelInfo } from '@database/types';
import { WebViewPostEvent } from '../WebViewReader';

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

export default function useTTS(
  webViewRef: React.RefObject<WebView | null>,
  novel: NovelInfo,
  chapter: ChapterInfo,
) {
  const { setChapterReaderSettings, ...readerSettings } =
    useChapterReaderSettings();
  const isTTSReadingRef = useRef<boolean>(false);
  const autoStartTTSRef = useRef<boolean>(false);
  const ttsQueueRef = useRef<string[]>([]);
  const ttsQueueIndexRef = useRef<number>(0);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const playListener = ttsMediaEmitter.addListener('TTSPlay', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && !tts.reading) { tts.resume(); }
      `);
    });
    const pauseListener = ttsMediaEmitter.addListener('TTSPause', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && tts.reading) { tts.pause(); }
      `);
    });
    const stopListener = ttsMediaEmitter.addListener('TTSStop', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts) { tts.stop(); }
      `);
    });
    const rewindListener = ttsMediaEmitter.addListener('TTSRewind', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && tts.started) { tts.rewind(); }
      `);
    });
    const prevListener = ttsMediaEmitter.addListener('TTSPrev', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && window.reader && window.reader.prevChapter) {
          window.reader.post({ type: 'prev', autoStartTTS: true });
        }
      `);
    });
    const nextListener = ttsMediaEmitter.addListener('TTSNext', () => {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && window.reader && window.reader.nextChapter) {
          window.reader.post({ type: 'next', autoStartTTS: true });
        }
      `);
    });
    const seekToListener = ttsMediaEmitter.addListener(
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

  useEffect(() => {
    if (isTTSReadingRef.current) {
      updateTTSNotification({
        novelName: novel?.name || 'Unknown',
        chapterName: chapter.name,
        coverUri: novel?.cover || '',
        isPlaying: isTTSReadingRef.current,
      });
    }
    return () => {
      dismissTTSNotification();
    };
  }, [novel?.name, novel?.cover, chapter.name]);

  useEffect(() => {
    const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
      switch (key) {
        case CHAPTER_READER_SETTINGS:
          // Stop any currently playing speech
          Speech.stop();

          // Update WebView settings
          webViewRef.current?.injectJavaScript(
            `
            reader.readerSettings.val = ${MMKVStorage.getString(
              CHAPTER_READER_SETTINGS,
            )};
            // Auto-restart TTS if currently reading
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
            `,
          );
          break;
        case CHAPTER_GENERAL_SETTINGS:
          webViewRef.current?.injectJavaScript(
            `reader.generalSettings.val = ${MMKVStorage.getString(
              CHAPTER_GENERAL_SETTINGS,
            )}`,
          );
          break;
      }
    });

    const subscription = deviceInfoEmitter.addListener(
      'RNDeviceInfo_batteryLevelDidChange',
      (level: number) => {
        webViewRef.current?.injectJavaScript(
          `reader.batteryLevel.val = ${level}`,
        );
      },
    );
    return () => {
      subscription.remove();
      mmkvListener.remove();
    };
  }, [setChapterReaderSettings, webViewRef]);

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
  }, [webViewRef]);

  const speakText = (text: string) => {
    Speech.speak(text, {
      onDone() {
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
      voice: readerSettings.tts?.voice?.identifier,
      pitch: readerSettings.tts?.pitch || 1,
      rate: readerSettings.tts?.rate || 1,
    });
  };

  function eventTTSQueue(event: WebViewPostEvent) {
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
  }

  function eventTTSSpeak(event: WebViewPostEvent) {
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
  }
  function eventTTSPauseSpeak() {
    Speech.stop();
  }
  function eventTTSStopSpeak() {
    Speech.stop();
    if (!autoStartTTSRef.current) {
      isTTSReadingRef.current = false;
      ttsQueueRef.current = [];
      ttsQueueIndexRef.current = 0;
      dismissTTSNotification();
    }
  }
  function eventTTSState(event: WebViewPostEvent) {
    if (event.data && typeof event.data === 'object') {
      const data = event.data as { isReading?: boolean };
      const isReading = data.isReading === true;
      isTTSReadingRef.current = isReading;
      updateTTSPlaybackState(isReading);
    }
  }

  return {
    isTTSReadingRef,
    autoStartTTSRef,
    appStateRef,
    speakText,
    eventTTSQueue,
    eventTTSSpeak,
    eventTTSPauseSpeak,
    eventTTSStopSpeak,
    eventTTSState,
  };
}
