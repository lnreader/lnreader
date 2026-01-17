import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  StatusBar,
  Text,
  View,
  Animated,
  PanResponder,
  StyleSheet,
} from 'react-native';
import * as Speech from 'expo-speech';

import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  CHAPTER_READER_SETTINGS,
  ChapterGeneralSettings,
  ChapterReaderSettings,
  initialChapterGeneralSettings,
  initialChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import {
  showTTSNotification,
  updateTTSNotification,
  dismissTTSNotification,
} from '@utils/ttsNotification';
import { useChapterContext } from '../ChapterContext';

/* ---------------------------------------------
 * Types
 * -------------------------------------------*/

type TextBlock = {
  id: string;
  text: string;
};

type TTSState = 'idle' | 'playing' | 'paused';

const LAST_TTS_INDEX_KEY = 'last_tts_index';

/* ---------------------------------------------
 * HTML → Text Blocks
 * -------------------------------------------*/

function extractTextBlocks(html?: string): TextBlock[] {
  if (!html || typeof html !== 'string') return [];

  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n{2,}/)
    .map((text, index) => ({
      id: String(index),
      text: text.trim(),
    }))
    .filter(b => b.text.length > 0);
}

/* ---------------------------------------------
 * Paragraph Block
 * -------------------------------------------*/

const ParagraphBlock = memo(
  ({
    text,
    readerSettings,
    index,
    active,
    onSpeak,
    onPress
  }: {
    text: string;
    readerSettings: ChapterReaderSettings;
    index: number;
    active: boolean;
    onSpeak(text: string, index: number): void;
    onPress(): void;
  }) => {
    return (
      <Pressable onLongPress={() => onSpeak(text, index)} onPress={onPress}>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: readerSettings.textSize,
            lineHeight: Math.max(
              readerSettings.lineHeight,
              readerSettings.textSize * 1.4,
            ),
            color: readerSettings.textColor,
            backgroundColor: active
              ? 'rgba(255,255,255,0.08)'
              : 'transparent',
            fontFamily: readerSettings.fontFamily,
            textAlign: readerSettings.textAlign,
            paddingHorizontal: readerSettings.padding,
            marginBottom: readerSettings.textSize * 0.8,
          }}
        >
          {text}
        </Text>
      </Pressable>
    );
  },
);

/* ---------------------------------------------
 * Floating TTS Button (Inconspicuous)
 * -------------------------------------------*/

const FloatingTTSButton = ({
  state,
  onPlay,
  onPause,
  visible,
  onDragStart,
  onDragEnd,
}: {
  state: TTSState;
  onPlay(): void;
  onPause(): void;
  visible: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  // Persist position in state to avoid reset on rerender
  const position = useRef(new Animated.ValueXY({ x: 16, y: 200 })).current;
  const lastOffset = useRef({ x: 16, y: 200 });
  const dragging = useRef(false);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // Reset position on chapter change (optional, can be removed if not desired)
  // useEffect(() => {
  //   position.setValue({ x: 16, y: 200 });
  //   lastOffset.current = { x: 16, y: 200 };
  // }, [/* chapter id here if needed */]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => dragging.current,
        onMoveShouldSetPanResponder: () => dragging.current,
        onPanResponderGrant: () => {
          scale.setValue(1.2);
          if (onDragStart) onDragStart();
        },
        onPanResponderMove: (_evt, gestureState) => {
          position.setValue({
            x: lastOffset.current.x + gestureState.dx,
            y: lastOffset.current.y + gestureState.dy,
          });
        },
        onPanResponderRelease: (_evt, gestureState) => {
          dragging.current = false;
          lastOffset.current = {
            x: lastOffset.current.x + gestureState.dx,
            y: lastOffset.current.y + gestureState.dy,
          };
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }).start();
          if (onDragEnd) onDragEnd();
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }).start();
          if (onDragEnd) onDragEnd();
        },
      }),
    [onDragStart, onDragEnd],
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        opacity,
        transform: [
          { translateX: position.x },
          { translateY: position.y },
          { scale },
        ],
        zIndex: 20,
        elevation: 20,
      }}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        onPress={state === 'playing' ? onPause : onPlay}
        onLongPress={() => {
          dragging.current = true;
          if (onDragStart) onDragStart();
          Animated.spring(scale, {
            toValue: 1.2,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          if (!dragging.current) {
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
            }).start();
          }
        }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: 'rgba(0, 0, 0, 1)',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }}
        android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: true }}
      >
        <Text style={{ color: '#fff', fontSize: 20 }}>
          {state === 'playing' ? '⏸' : '▶'}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

/* ---------------------------------------------
 * Native Reader
 * -------------------------------------------*/

const NativeReader: React.FC<{ onPress(): void }> = ({ onPress }) => {
  const { novel, chapter, chapterText } = useChapterContext();

  const [readerSettings,setReaderSettings] = useState<ChapterReaderSettings>(
    () =>
      getMMKVObject(CHAPTER_READER_SETTINGS) || initialChapterReaderSettings,
  );

  const [chapterGeneralSettings, setChapterGeneralSettings] = useState(
    () =>
      getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) || initialChapterGeneralSettings,
  );

  console.log(readerSettings);
  
  useEffect(() => {
    const mmkvListener = MMKVStorage.addOnValueChangedListener(key=>{
      if (key === CHAPTER_READER_SETTINGS) {
        const updatedSettings =
          getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
          initialChapterReaderSettings;
        setReaderSettings(updatedSettings);
    }else if( key === CHAPTER_GENERAL_SETTINGS){
        const updatedGeneralSettings =
          getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) ||
          initialChapterGeneralSettings;
        setChapterGeneralSettings(updatedGeneralSettings);
      }
    });
    return () => {
      mmkvListener.remove();
    };
  }, [chapter]);

  useMemo(
    () =>
      getMMKVObject(CHAPTER_GENERAL_SETTINGS) || initialChapterGeneralSettings,
    [chapter],
  );

  const onPressed = () => {
    console.log('Background pressed');
    onPress();
  }
  const blocks = useMemo(() => extractTextBlocks(chapterText), [chapterText]);

  const queueRef = useRef<TextBlock[]>([]);
  const indexRef = useRef(
    MMKVStorage.getNumber(LAST_TTS_INDEX_KEY) ?? 0,
  );
  const activeIndexRef = useRef<number | null>(null);
  const stateRef = useRef<TTSState>('idle');
  const [, rerender] = useState(0);

  const [buttonVisible, setButtonVisible] = useState(false);
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);
  const dragging = useRef(false);

  const showButtonTemporarily = () => {
    setButtonVisible(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      setButtonVisible(false);
    }, 1500);
  };

  // Prevent hiding while dragging
  const handleDragStart = () => {
    dragging.current = true;
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setButtonVisible(true);
  };
  const handleDragEnd = () => {
    dragging.current = false;
    showButtonTemporarily();
  };

  const sync = () => rerender(v => v + 1);

  const speakNext = useCallback(() => {
    const item = queueRef.current[indexRef.current];
    if (!item) {
      stateRef.current = 'idle';
      activeIndexRef.current = null;
      dismissTTSNotification();
      sync();
      return;
    }

    activeIndexRef.current = indexRef.current;
    MMKVStorage.set(LAST_TTS_INDEX_KEY, indexRef.current);
    sync();

    Speech.speak(item.text, {
      rate: readerSettings.tts?.rate ?? 1,
      pitch: readerSettings.tts?.pitch ?? 1,
      voice: readerSettings.tts?.voice?.identifier,
      onDone() {
        indexRef.current += 1;
        speakNext();
      },
    });
  }, [readerSettings]);

  const playTTS = () => {
    queueRef.current = blocks;
    stateRef.current = 'playing';
    sync();
    showTTSNotification({
      novelName: novel.name,
      chapterName: chapter.name,
      isPlaying: true,
    });
    Speech.stop();
    speakNext();
  };

  const pauseTTS = () => {
    stateRef.current = 'paused';
    Speech.stop();
    updateTTSNotification({
      isPlaying: false,
      novelName: novel.name,
      chapterName: chapter.name,
    });
    sync();
  };
  // No longer needed: handleBackgroundPress

  console.log(readerSettings.tts)
  return (
    <View style={{ flex: 1 }}>
      {/* Background overlay to catch taps */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        android_ripple={{ color: 'transparent' }}
        pointerEvents="auto"
      />
      {/* Main content, allow touches to pass through to children */}
      <View
        style={{
          flex: 1,
          backgroundColor: readerSettings.theme,
          paddingTop: StatusBar.currentHeight,
        }}
        pointerEvents="box-none"
      >
        <FlatList
          data={blocks}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <ParagraphBlock
              text={item.text}
              readerSettings={readerSettings}
              index={index}
              onPress={onPressed}
              active={activeIndexRef.current === index}
              onSpeak={(_, i) => {
                indexRef.current = i;
                playTTS();
              }}
            />
          )}
          onScrollBeginDrag={showButtonTemporarily}
          onTouchStart={showButtonTemporarily}
          keyboardShouldPersistTaps="handled"
        />

       { chapterGeneralSettings.TTSEnable && (<FloatingTTSButton
          state={stateRef.current}
          onPlay={playTTS}
          onPause={pauseTTS}
          visible={buttonVisible}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />)}
      </View>
    </View>
  );
};

export default memo(NativeReader);
