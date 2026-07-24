import React, { useCallback, useEffect } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import WebView from 'react-native-webview';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  CHAPTER_READER_SETTINGS,
  ChapterReaderSettings,
  useChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import { getBatteryLevelSync } from 'react-native-device-info';
import { areTTSSettingsEqual } from './useTTS';

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

interface UseUpdateWebviewOptions {
  webViewRef: React.RefObject<WebView<{}> | null>;
  readerSettingsRef: React.MutableRefObject<ChapterReaderSettings>;
  searchTextRef: React.MutableRefObject<string>;
  autoStartTTSRef: React.MutableRefObject<boolean>;
  onTTSSettingsChanged: () => void;
}

export function useUpdateWebview(options: UseUpdateWebviewOptions): {
  handleLoadEnd: () => void;
} {
  const {
    webViewRef,
    searchTextRef,
    readerSettingsRef,
    autoStartTTSRef,
    onTTSSettingsChanged,
  } = options;

  const { setChapterReaderSettings, ...readerSettings } =
    useChapterReaderSettings();

  // MMKV + battery listener
  useEffect(() => {
    const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
      switch (key) {
        case CHAPTER_READER_SETTINGS: {
          const settingsString =
            MMKVStorage.getString(CHAPTER_READER_SETTINGS) ?? '{}';
          const settings = JSON.parse(settingsString);
          if (
            !areTTSSettingsEqual(readerSettingsRef.current.tts, settings.tts)
          ) {
            onTTSSettingsChanged();
          }
          readerSettingsRef.current = settings;
          webViewRef.current?.injectJavaScript(
            `
            reader.readerSettings.val = ${settingsString}
            `,
          );
          break;
        }
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
  }, [webViewRef, readerSettingsRef, onTTSSettingsChanged, readerSettings]);

  const handleLoadEnd = useCallback(() => {
    const currentBatteryLevel = getBatteryLevelSync();
    webViewRef.current?.injectJavaScript(
      `if (window.reader && window.reader.batteryLevel) {
        window.reader.batteryLevel.val = ${currentBatteryLevel};
      }`,
    );
    const searchText = searchTextRef.current.trim();
    if (searchText) {
      webViewRef.current?.injectJavaScript(
        `window.readerSearch?.search(${JSON.stringify(searchText)}); true;`,
      );
    }
    if (autoStartTTSRef.current) {
      autoStartTTSRef.current = false;
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
          (function() {
            if (window.tts && reader.generalSettings.val.TTSEnable) {
              setTimeout(() => {
                tts.start();
                const controller = document.getElementById('TTS-Controller');
                if (controller && controller.firstElementChild) {
                  controller.firstElementChild.innerHTML = pauseIcon;
                }
              }, 500);
            }
          })();
        `);
      }, 300);
    }
  }, [webViewRef, searchTextRef, autoStartTTSRef]);

  return {
    handleLoadEnd,
  };
}
