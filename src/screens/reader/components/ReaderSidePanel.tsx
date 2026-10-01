import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { AppHost, AppText, IconButtonV2, useScreenInsets } from '@components';
import CloseIcon from '@expo/material-symbols/close.xml';

const DURATION = 250;
/**
 * How far in from the screen edge a swipe can start opening the panel; wider
 * than Android's own back-gesture zone, which takes swipes at the very edge.
 */
const EDGE_WIDTH = 48;
const FLING_VELOCITY = 500;
const SCRIM_OPACITY = 0.32;

interface ReaderSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: 'start' | 'end';
  width: number;
  /** A Compose title bar with a close button. */
  title?: string;
  /** Dim the page behind it; otherwise it stays clear, e.g. for settings. */
  scrim?: boolean;
  /** Swipe in from the screen edge to open, and the panel back to close. */
  swipeable?: boolean;
  /**
   * Where the edge strip stops short of the top and bottom, so the bars'
   * buttons there still get their taps.
   */
  edgeInsets?: { top: number; bottom: number };
  /** A tap on the edge strip, which the page under it can't get. */
  onEdgeTap?: () => void;
  /** Keep the content mounted while closed, e.g. a long list to show at once. */
  keepMounted?: boolean;
  children: ReactNode;
}

/**
 * A panel that slides in over the reader, used for the chapter list and the
 * tablet settings. Hand-rolled rather than react-native-drawer-layout: with
 * that drawer open, the hardware Back button never closed it, and Compose
 * hosts in its closed panel laid out at zero height.
 */
const ReaderSidePanel = ({
  open,
  onOpenChange,
  side,
  width,
  title,
  scrim = false,
  swipeable = false,
  keepMounted = false,
  edgeInsets,
  onEdgeTap,
  children,
}: ReaderSidePanelProps) => {
  const theme = useTheme();
  const insets = useScreenInsets();
  const progress = useSharedValue(open ? 1 : 0);
  // Touchable (and, unless kept mounted, rendered) while open or animating.
  const [shown, setShown] = useState(open);
  const direction = side === 'start' ? -1 : 1;

  if (open && !shown) {
    setShown(true);
  }

  useEffect(() => {
    progress.set(
      withTiming(open ? 1 : 0, { duration: DURATION }, done => {
        if (done && !open) {
          runOnJS(setShown)(false);
        }
      }),
    );
  }, [open, progress]);

  const settle = (opened: boolean) => {
    'worklet';
    progress.set(
      withTiming(opened ? 1 : 0, { duration: DURATION }, done => {
        // Also when `open` doesn't change, e.g. a swipe that falls back.
        if (done && !opened) {
          runOnJS(setShown)(false);
        }
      }),
    );
    runOnJS(onOpenChange)(opened);
  };
  const decide = (velocity: number) => {
    'worklet';
    // Velocity toward the panel's side closes it.
    const toward = velocity * direction;
    return toward > FLING_VELOCITY
      ? false
      : toward < -FLING_VELOCITY
      ? true
      : progress.get() > 0.5;
  };

  const openSwipe = Gesture.Pan()
    .activeOffsetX(side === 'start' ? 10 : -10)
    .failOffsetY([-20, 20])
    .onStart(() => runOnJS(setShown)(true))
    .onUpdate(event => {
      progress.set(
        Math.min(1, Math.max(0, (-direction * event.translationX) / width)),
      );
    })
    .onEnd(event => settle(decide(event.velocityX)))
    .onFinalize((_, success) => {
      if (!success) {
        settle(false);
      }
    });

  const closeSwipe = Gesture.Pan()
    .enabled(swipeable)
    .activeOffsetX(side === 'start' ? -15 : 15)
    .failOffsetY([-15, 15])
    .onUpdate(event => {
      progress.set(
        Math.min(1, Math.max(0, 1 - (direction * event.translationX) / width)),
      );
    })
    .onEnd(event => settle(decide(event.velocityX)));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: direction * width * (1 - progress.get()) }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * SCRIM_OPACITY,
  }));

  const edgeTap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => onEdgeTap?.());

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {shown ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onOpenChange(false)}
          accessibilityLabel={getString('common.close')}
        >
          {scrim ? (
            <Reanimated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: theme.scrim ?? '#000' },
                scrimStyle,
              ]}
            />
          ) : null}
        </Pressable>
      ) : null}
      {/* Over the page (a WebView would take the swipe from the page itself);
          kept mounted while opening, as removing it would cancel the swipe. */}
      {swipeable ? (
        <GestureDetector gesture={Gesture.Exclusive(openSwipe, edgeTap)}>
          <View
            style={[
              styles.edge,
              side === 'start' ? styles.left : styles.right,
              { top: edgeInsets?.top ?? 0, bottom: edgeInsets?.bottom ?? 0 },
            ]}
          />
        </GestureDetector>
      ) : null}
      <GestureDetector gesture={closeSwipe}>
        <Reanimated.View
          pointerEvents={shown ? 'auto' : 'none'}
          style={[
            styles.panel,
            side === 'start' ? styles.left : styles.right,
            {
              width: width + (side === 'start' ? insets.left : insets.right),
              backgroundColor: theme.surfaceContainerLow,
            },
            panelStyle,
          ]}
        >
          {title ? (
            <AppHost style={{ height: 64 + insets.top }}>
              <Row
                verticalAlignment="center"
                modifiers={[
                  fillMaxWidth(),
                  height(64 + insets.top),
                  padding(16, insets.top, 4 + insets.right, 0),
                ]}
              >
                <AppText variant="titleLarge" modifiers={[weight(1)]}>
                  {title}
                </AppText>
                <IconButtonV2
                  name={CloseIcon}
                  accessibilityLabel={getString('common.close')}
                  onPress={() => onOpenChange(false)}
                  theme={theme}
                />
              </Row>
            </AppHost>
          ) : null}
          {keepMounted || shown ? children : null}
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, bottom: 0 },
  edge: { position: 'absolute', width: EDGE_WIDTH },
  left: { left: 0 },
  right: { right: 0 },
});

export default ReaderSidePanel;
