import { useEffect, useState } from 'react';
import { Box, Row, Surface } from '@expo/ui/jetpack-compose';
import {
  clip,
  fillMaxSize,
  padding,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useChapterGeneralSettings } from '@hooks/persisted';
import { useTheme } from '@hooks/persisted/useTheme';
import { getString } from '@i18n/translations';
import { useChapterContext } from '../ChapterContext';
import DragHandleIcon from '@expo/material-symbols/drag_handle.xml';
import PauseIcon from '@expo/material-symbols/pause.xml';
import PlayArrowIcon from '@expo/material-symbols/play_arrow.xml';
import RecordVoiceOverIcon from '@expo/material-symbols/record_voice_over.xml';
import RemoveIcon from '@expo/material-symbols/remove.xml';
import SkipNextIcon from '@expo/material-symbols/skip_next.xml';
import SkipPreviousIcon from '@expo/material-symbols/skip_previous.xml';
import StopIcon from '@expo/material-symbols/stop.xml';
import {
  AppHost,
  AppIcon,
  IconButtonV2,
  AppText,
  useScreenInsets,
} from '@components';
import { useWindowLayout } from '@hooks/common/useWindowLayout';

// Compose hosts need explicit sizes.
export const TTS_HEIGHT = 48;

export const TTS_HANDLE_WIDTH = 40;

const TTS_BUTTON_WIDTH = 48;

const TTS_PROGRESS_WIDTH = 56;

export const TTS_PADDING = 8;

const TTS_TAP_SLOP = 6;

const TTS_TARGET_MS = 50;

type Point = { x: number; y: number };

const ReaderTtsController = () => {
  const theme = useTheme();
  const layout = useWindowLayout();
  const insets = useScreenInsets();
  const { tts } = useChapterContext();
  const { TTSEnable = true } = useChapterGeneralSettings();
  const [collapsed, setCollapsed] = useState(true);
  const [dragging, setDragging] = useState(false);
  const active = tts.state === 'playing' || tts.state === 'paused';
  const showProgress = active && tts.progress.total > 0;
  const buttons = active ? 5 : 4;
  const width = collapsed
    ? TTS_HEIGHT
    : TTS_PADDING * 2 +
      TTS_HANDLE_WIDTH +
      TTS_BUTTON_WIDTH * buttons +
      (showProgress ? TTS_PROGRESS_WIDTH : 0);

  const x = useSharedValue(insets.left + 16);
  const y = useSharedValue(Math.round(layout.height / 2));
  const origin = useSharedValue<Point>({ x: 0, y: 0 });
  const lastTarget = useSharedValue(0);
  const position = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));
  const clamp = ({ x: left, y: top }: Point): Point => ({
    x: Math.min(
      Math.max(insets.left + 8, left),
      layout.width - insets.right - width - 8,
    ),
    y: Math.min(
      Math.max(insets.top + 8, top),
      layout.height - insets.bottom - TTS_HEIGHT - 8,
    ),
  });
  const moveTo = (point: Point) => {
    const next = clamp(point);
    x.set(next.x);
    y.set(next.y);
  };
  // Opening the controls or rotating may push them past an edge.
  useEffect(() => {
    moveTo({ x: x.get(), y: y.get() });
  });
  // Turning read-aloud off also ends what it is reading.
  const stopTts = tts.stop;
  useEffect(() => {
    if (!TTSEnable && active) {
      stopTts();
    }
  }, [TTSEnable, active, stopTts]);

  // The bubble and the handle both read from the paragraph they're dropped on.
  const drag = () =>
    Gesture.Pan()
      .runOnJS(true)
      .minDistance(TTS_TAP_SLOP)
      .onStart(() => {
        origin.set({ x: x.get(), y: y.get() });
        setDragging(true);
      })
      .onUpdate(event => {
        const from = origin.get();
        moveTo({
          x: from.x + event.translationX,
          y: from.y + event.translationY,
        });
        const now = Date.now();
        if (now - lastTarget.get() >= TTS_TARGET_MS) {
          lastTarget.set(now);
          tts.target({ x: event.absoluteX, y: event.absoluteY });
        }
      })
      .onEnd(event => {
        tts.startAt({ x: event.absoluteX, y: event.absoluteY });
      })
      .onFinalize(() => {
        setDragging(false);
        tts.target();
      });
  const bubble = Gesture.Exclusive(
    drag(),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => setCollapsed(false)),
  );
  const handle = drag();

  if (!TTSEnable) {
    return null;
  }
  const containerColor = theme.secondaryContainer;
  const contentColor = theme.onSecondaryContainer;

  const controller = (
    <Reanimated.View
      style={[
        styles.tts,
        { width, opacity: dragging || active ? 1 : 0.78 },
        position,
      ]}
      accessible={collapsed}
      accessibilityRole={collapsed ? 'button' : undefined}
      accessibilityLabel={
        collapsed ? getString('readerSettings.readAloud') : undefined
      }
    >
      <AppHost style={styles.fill} pointerEvents={collapsed ? 'none' : 'auto'}>
        <Surface
          color={containerColor}
          contentColor={contentColor}
          modifiers={[
            fillMaxSize(),
            clip(Shapes.RoundedCorner(TTS_HEIGHT / 2)),
          ]}
        >
          {collapsed ? (
            <Box contentAlignment="center" modifiers={[fillMaxSize()]}>
              <AppIcon source={RecordVoiceOverIcon} tint={contentColor} />
            </Box>
          ) : (
            <Row
              verticalAlignment="center"
              modifiers={[
                fillMaxSize(),
                padding(TTS_PADDING, 0, TTS_PADDING, 0),
              ]}
            >
              <Box
                contentAlignment="center"
                modifiers={[size(TTS_HANDLE_WIDTH, TTS_HEIGHT)]}
              >
                <AppIcon source={DragHandleIcon} tint={contentColor} />
              </Box>
              <IconButtonV2
                name={SkipPreviousIcon}
                accessibilityLabel={getString(
                  'readerSettings.previousSentence',
                )}
                disabled={!active}
                onPress={() => tts.command('previous')}
                theme={theme}
              />
              <IconButtonV2
                name={tts.state === 'playing' ? PauseIcon : PlayArrowIcon}
                accessibilityLabel={getString(
                  tts.state === 'playing' ? 'common.pause' : 'common.play',
                )}
                onPress={() =>
                  tts.state === 'playing'
                    ? tts.command('pause')
                    : tts.state === 'paused'
                    ? tts.command('play')
                    : tts.start()
                }
                theme={theme}
              />
              <IconButtonV2
                name={SkipNextIcon}
                accessibilityLabel={getString('readerSettings.nextSentence')}
                disabled={!active}
                onPress={() => tts.command('next')}
                theme={theme}
              />
              {active ? (
                <IconButtonV2
                  name={StopIcon}
                  accessibilityLabel={getString('common.stop')}
                  onPress={tts.stop}
                  theme={theme}
                />
              ) : null}
              {showProgress ? (
                <Box
                  contentAlignment="center"
                  modifiers={[size(TTS_PROGRESS_WIDTH, TTS_HEIGHT)]}
                >
                  <AppText variant="labelMedium" color={contentColor}>
                    {`${tts.progress.index + 1}/${tts.progress.total}`}
                  </AppText>
                </Box>
              ) : null}
              {/* Last, away from the handle and the playback buttons. */}
              <IconButtonV2
                name={RemoveIcon}
                accessibilityLabel={getString('readerSettings.ttsMinimize')}
                onPress={() => setCollapsed(true)}
                theme={theme}
              />
            </Row>
          )}
        </Surface>
      </AppHost>
      {collapsed ? null : (
        <GestureDetector gesture={handle}>
          <View
            style={styles.ttsHandle}
            accessible
            accessibilityLabel={getString('readerSettings.ttsMove')}
          />
        </GestureDetector>
      )}
    </Reanimated.View>
  );
  return collapsed ? (
    <GestureDetector gesture={bubble}>{controller}</GestureDetector>
  ) : (
    controller
  );
};

const styles = StyleSheet.create({
  tts: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: TTS_HEIGHT,
  },
  ttsHandle: {
    position: 'absolute',
    left: TTS_PADDING,
    top: 0,
    width: TTS_HANDLE_WIDTH,
    height: TTS_HEIGHT,
  },
  fill: { flex: 1 },
});

export default ReaderTtsController;
