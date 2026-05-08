import { Appbar } from '@components';
import { ThemeColors } from '@theme/types';
import React from 'react';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SelfHidingAppBarProps = {
  title: string;
  handleGoBack?: () => void;
  theme: ThemeColors;
  mode?: 'small' | 'medium' | 'large' | 'center-aligned';
  children?: React.ReactNode;
  hiddenState: SharedValue<number>;
  animationDuration?: SharedValue<number>;
};

const APP_BAR_HEIGHT = 150;

const SelfHidingAppBar = ({
  hiddenState,
  animationDuration,
  ...props
}: SelfHidingAppBarProps) => {
  const { top } = useSafeAreaInsets();

  const hideAppBar = useAnimatedStyle(() => {
    // The animation now depends on the shared value's .value
    const isHidden = hiddenState.value === 1;
    return {
      height: withTiming(isHidden ? top : APP_BAR_HEIGHT, {
        duration: animationDuration?.value ?? 250,
        easing: Easing.out(Easing.cubic),
      }),
      overflow: 'hidden',
    };
  });

  return (
    <Animated.View style={hideAppBar}>
      <Appbar {...props} />
    </Animated.View>
  );
};

export default SelfHidingAppBar;
