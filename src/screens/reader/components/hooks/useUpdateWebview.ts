import React, { useCallback, useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import WebView from 'react-native-webview';

import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import {
 CHAPTER_GENERAL_SETTINGS,
 CHAPTER_READER_SETTINGS,
 ChapterGeneralSettings,
 ChapterReaderSettings,
 initialChapterGeneralSettings,
 initialChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import { getBatteryLevel } from 'react-native-device-info';
import { areTTSSettingsEqual } from './useTTS';
import { getString } from '@i18n/translations';
import { ChapterInfo } from '@database/types';
import { useChapterContext } from '../ChapterContext';

/**
 * The adjacent chapters are resolved after the chapter itself is on screen, so
 * they are pushed into the loaded page instead of being baked into the HTML –
 * rebuilding the HTML would reload the WebView and lose the reading position.
 */
export const buildAdjacentChapterScript = (
 nextChapter?: ChapterInfo,
 prevChapter?: ChapterInfo,
) => `
  window.reader?.setAdjacentChapters?.(${JSON.stringify({
 nextChapter,
 prevChapter,
 strings: {
  nextChapter: getString('readerScreen.nextChapter', {
   name: nextChapter?.name,
  }),
 },
})});
  true;
`;

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

/**
 * Last level seen, so a chapter can be rendered without the synchronous native
 * call the sync variant of this API performs. It is refreshed asynchronously
 * and pushed into the page, which also happens on every battery change event.
 */
export let lastKnownBatteryLevel = 0;

interface UseUpdateWebviewOptions {
 webViewRef: React.RefObject<WebView<{}> | null>;
 searchTextRef: React.MutableRefObject<string>;
 autoStartTTSRef: React.MutableRefObject<boolean>;
 readerSettingsRef: React.MutableRefObject<ChapterReaderSettings>;
 setChapterReaderSettings: (
  settings: ChapterReaderSettings | ((prev: ChapterReaderSettings) => ChapterReaderSettings),
 ) => void;
 onTTSSettingsChanged: () => void;
}

export function useUpdateWebview(options: UseUpdateWebviewOptions): {
 handleLoadEnd: () => void;
} {
 const {
  webViewRef,
  searchTextRef,
  autoStartTTSRef,
  readerSettingsRef,
  setChapterReaderSettings,
  onTTSSettingsChanged,
 } = options;

 const adjacentChapterScriptRef = useRef(buildAdjacentChapterScript());

 // Adjacent chapter injection
 const { nextChapter, prevChapter } = useChapterContext();
 useEffect(() => {
  const script = buildAdjacentChapterScript(nextChapter, prevChapter);
  // Kept for onLoadEnd: an update that lands before the document is ready is
  // dropped by the WebView, so it is replayed once the page has loaded.
  adjacentChapterScriptRef.current = script;
  webViewRef.current?.injectJavaScript(script);
 }, [nextChapter, prevChapter, webViewRef]);

 // MMKV + battery listener
 useEffect(() => {
  const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
   switch (key) {
    case CHAPTER_READER_SETTINGS: {
     // Update reader settings
     const newReaderSettings =
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
      initialChapterReaderSettings;
     setChapterReaderSettings(newReaderSettings);
     const ttsChanged = !areTTSSettingsEqual(
      readerSettingsRef.current.tts,
      newReaderSettings.tts,
     );
     readerSettingsRef.current = newReaderSettings;
     if (ttsChanged) {
      onTTSSettingsChanged();
     }
     // Update WebView settings
     webViewRef.current?.injectJavaScript(
      `
            reader.readerSettings.val = ${JSON.stringify(newReaderSettings)}
            `,
     );
     break;
    }
    case CHAPTER_GENERAL_SETTINGS: {
     const newGeneralSettings =
      getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) ||
      initialChapterGeneralSettings;
     webViewRef.current?.injectJavaScript(
      `reader.generalSettings.val = ${JSON.stringify(
       newGeneralSettings,
      )}`,
     );
     break;
    }
   }
  });

  const subscription = deviceInfoEmitter.addListener(
   'RNDeviceInfo_batteryLevelDidChange',
   (level: number) => {
    lastKnownBatteryLevel = level;
    webViewRef.current?.injectJavaScript(
     `reader.batteryLevel.val = ${level}`,
    );
   },
  );

  getBatteryLevel().then(level => {
   lastKnownBatteryLevel = level;
   webViewRef.current?.injectJavaScript(
    `if (window.reader?.batteryLevel) {
          window.reader.batteryLevel.val = ${level};
        }`,
   );
  });

  return () => {
   subscription.remove();
   mmkvListener.remove();
  };
 }, [webViewRef]);

 const handleLoadEnd = useCallback(() => {
  webViewRef.current?.injectJavaScript(
   `if (window.reader && window.reader.batteryLevel) {
        window.reader.batteryLevel.val = ${lastKnownBatteryLevel};
      }`,
  );
  webViewRef.current?.injectJavaScript(adjacentChapterScriptRef.current);

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
