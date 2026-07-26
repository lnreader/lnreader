import React, { useCallback, useEffect, useRef } from 'react';
import WebView from 'react-native-webview';

import { ChapterReaderSettings } from '@hooks/persisted/useSettings';
import { useTtsSession } from '../hooks/useTtsSession';
import type { TtsSettings } from '@modules/nitro-tts';
import { NovelInfo, ChapterInfo } from '@database/types';

export type WebViewPostEvent = {
  type: string;
  data?: unknown;
  autoStartTTS?: boolean;
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
    a.voice?.identifier === b.voice?.identifier &&
    a.engine?.name === b.engine?.name
  );
};

export const toNativeTtsSettings = (
  settings: ChapterReaderSettings['tts'],
): TtsSettings => ({
  engineName: settings?.engine?.name,
  voiceIdentifier: settings?.voice?.identifier,
  rate: settings?.rate ?? 1,
  pitch: settings?.pitch ?? 1,
});

interface UseTTSOptions {
  webViewRef: React.RefObject<WebView<{}> | null>;
  isTTSReadingRef: React.MutableRefObject<boolean>;
  novel: NovelInfo;
  chapter: ChapterInfo;
  readerSettingsRef: React.MutableRefObject<ChapterReaderSettings>;
}

export function useTTS(options: UseTTSOptions): {
  handleTTSEvent: (event: WebViewPostEvent) => boolean;
  onTTSSettingsChanged: () => void;
  autoStartTTSRef: React.MutableRefObject<boolean>;
} {
  const { webViewRef, isTTSReadingRef, novel, chapter, readerSettingsRef } =
    options;

  const {
    command: runTtsCommand,
    loadAndPlay,
    progress: ttsProgress,
    seekTo: seekTts,
    state: ttsState,
    updateSettings: updateTtsSettings,
  } = useTtsSession();

  const autoStartTTSRef = useRef<boolean>(false);
  const activeChapterIdRef = useRef(chapter.id);

  // ttsState sync
  useEffect(() => {
    isTTSReadingRef.current = ttsState === 'playing';
    webViewRef.current?.injectJavaScript(
      `window.tts?.setPlaybackState?.(${JSON.stringify(ttsState)});true;`,
    );
    if (ttsState === 'completed') {
      webViewRef.current?.injectJavaScript(
        'window.tts?.complete?.(); true;',
      );
    }
  }, [isTTSReadingRef, ttsState, webViewRef]);

  // ttsProgress sync
  useEffect(() => {
    if (ttsProgress.total > 0) {
      webViewRef.current?.injectJavaScript(
        `window.tts?.setActiveIndex?.(${ttsProgress.index});true;`,
      );
    }
  }, [ttsProgress, webViewRef]);

  // Chapter change stop
  useEffect(() => {
    if (activeChapterIdRef.current !== chapter.id) {
      activeChapterIdRef.current = chapter.id;
      runTtsCommand('stop');
    }
  }, [chapter.id, runTtsCommand]);

  const handleTTSEvent = useCallback(
    (event: WebViewPostEvent): boolean => {
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
          const startIndex =
            typeof payload?.startIndex === 'number'
              ? payload.startIndex
              : 0;
          void loadAndPlay(
            queue,
            startIndex,
            {
              novelName: novel?.name || 'Unknown',
              chapterName: chapter.name,
              coverUri: novel?.cover || undefined,
            },
            toNativeTtsSettings(readerSettingsRef.current.tts),
          );
          return true;
        }
        case 'tts-command': {
          if (!event.data || typeof event.data !== 'object') {
            return true;
          }
          const data = event.data as {
            command?: unknown;
            index?: unknown;
          };
          switch (data.command) {
            case 'next':
            case 'pause':
            case 'play':
            case 'previous':
            case 'replay':
            case 'stop':
              runTtsCommand(data.command);
              break;
            case 'seekTo':
              if (typeof data.index === 'number') {
                seekTts(data.index);
              }
              break;
          }
          return true;
        }
        default:
          return false;
      }
    },
    [loadAndPlay, novel, chapter, readerSettingsRef, runTtsCommand, seekTts],
  );

  const onTTSSettingsChanged = useCallback(() => {
    updateTtsSettings(toNativeTtsSettings(readerSettingsRef.current.tts));
  }, [updateTtsSettings, readerSettingsRef]);

  return {
    handleTTSEvent,
    onTTSSettingsChanged,
    autoStartTTSRef,
  };
}
