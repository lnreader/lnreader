import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import React, { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { useTheme } from '@hooks/persisted';

// MD3 Switch dimensions
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const TRACK_RADIUS = TRACK_HEIGHT / 2;
const THUMB_SIZE_OFF = 16;
const THUMB_SIZE_ON = 24;
const TRACK_BORDER_WIDTH = 2;

// Thumb positions: centered vertically, padded from edges
const THUMB_OFFSET_OFF = (TRACK_HEIGHT - THUMB_SIZE_OFF) / 2;
const THUMB_OFFSET_ON =
  TRACK_WIDTH - THUMB_SIZE_ON - (TRACK_HEIGHT - THUMB_SIZE_ON) / 2;

interface SwitchProps {
  value: boolean;
  onValueChange?: () => void;
  style?: StyleProp<ViewStyle>;
}

const Switch = ({ value, onValueChange, style }: SwitchProps) => {
  const theme = useTheme();

  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [progress, value]);

  // Animate thumb position
  const thumbPositionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(value ? THUMB_OFFSET_ON : THUMB_OFFSET_OFF, {
          mass: 1,
          damping: 15,
          stiffness: 120,
          overshootClamping: false,
        }),
      },
    ],
  }));

  // Animate thumb size
  const thumbSizeStyle = useAnimatedStyle(() => {
    const size = withSpring(value ? THUMB_SIZE_ON : THUMB_SIZE_OFF, {
      mass: 1,
      damping: 15,
      stiffness: 120,
      overshootClamping: false,
    });
    return {
      width: size,
      height: size,
      borderRadius: size,
    };
  });

  // Animate track background color
  const trackBgColor = useDerivedValue(
    () =>
      interpolateColor(
        progress.value,
        [0, 1],
        [theme.surfaceVariant, theme.primary],
      ),
    [theme.surfaceVariant, theme.primary],
  );

  const trackColorStyle = useAnimatedStyle(() => ({
    backgroundColor: trackBgColor.value,
  }));

  // Animate track border
  const trackBorderStyle = useAnimatedStyle(() => ({
    borderWidth: withTiming(value ? 0 : TRACK_BORDER_WIDTH, { duration: 200 }),
    borderColor: theme.outline,
  }));

  // Animate thumb color
  const thumbBgColor = useDerivedValue(
    () =>
      interpolateColor(
        progress.value,
        [0, 1],
        [theme.outline, theme.onPrimary],
      ),
    [theme.outline, theme.onPrimary],
  );

  const thumbColorStyle = useAnimatedStyle(() => ({
    backgroundColor: thumbBgColor.value,
  }));

  return (
    <Pressable onPress={onValueChange}>
      <Animated.View
        style={[styles.track, style, trackColorStyle, trackBorderStyle]}
      >
        <Animated.View
          style={[
            styles.thumb,
            thumbPositionStyle,
            thumbSizeStyle,
            thumbColorStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

export default React.memo(Switch);

const styles = StyleSheet.create({
  thumb: {
    elevation: 1,
    shadowColor: 'black',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 1,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    justifyContent: 'center',
  },
});
