import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedHeightProps {
  expanded: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

const AnimatedHeight: React.FC<AnimatedHeightProps> = ({
  expanded,
  children,
  style,
  duration = 250,
}) => {
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const height = useSharedValue(0);
  const opacity = useSharedValue(0);
  const overflowVisible = useSharedValue(false);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = event.nativeEvent.layout.height;

      if (nextHeight <= 0) {
        return;
      }

      setMeasuredHeight(currentHeight =>
        Math.abs(currentHeight - nextHeight) > 0.5 ? nextHeight : currentHeight,
      );
    },
    [setMeasuredHeight],
  );

  useEffect(() => {
    cancelAnimation(height);
    cancelAnimation(opacity);

    overflowVisible.value = false;

    if (!expanded) {
      height.value = withTiming(0, {
        duration: duration * 0.7,
        easing: Easing.in(Easing.cubic),
      });

      opacity.value = withTiming(0, {
        duration: duration * 0.7,
        easing: Easing.in(Easing.cubic),
      });

      return;
    }

    if (measuredHeight === 0) {
      return;
    }

    height.value = withTiming(
      measuredHeight,
      {
        duration,
        easing: Easing.out(Easing.cubic),
      },
      finished => {
        if (finished) {
          overflowVisible.value = true;
        }
      },
    );

    opacity.value = withTiming(1, {
      duration: duration * 0.6,
      easing: Easing.out(Easing.cubic),
    });
  }, [duration, expanded, height, measuredHeight, opacity, overflowVisible]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: overflowVisible.value ? 'visible' : 'hidden',
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      <View onLayout={onLayout} style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    top: 14,
    right: 0,
    left: 0,
  },
});

export default React.memo(AnimatedHeight);
