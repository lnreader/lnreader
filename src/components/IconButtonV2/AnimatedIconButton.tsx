import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import Color from 'color';

import { ThemeColors } from '../../theme/types';
import { MaterialDesignIconName } from '@type/icon';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

const AnimatedIcon = Animated.createAnimatedComponent(MaterialCommunityIcons);

type Props = {
  name: MaterialDesignIconName;
  color?: string;
  size?: number;
  disabled?: boolean;
  padding?: number;
  onPress?: () => void;
  theme: ThemeColors;
  style?: ViewStyle;
  rotation?: SharedValue<number>;
  scale?: SharedValue<number>;
};

const AnimatedIconButton: React.FC<Props> = ({
  name,
  color,
  size = 24,
  padding = 8,
  onPress,
  disabled,
  theme,
  style,
  rotation,
  scale: _scale,
}) => {
  const IconStyle = useAnimatedStyle(() => {
    const rotate = rotation
      ? withTiming(rotation.value + 'deg', { duration: 250 })
      : '0deg';
    const scale = _scale ? withTiming(_scale.value, { duration: 250 }) : 1;
    return {
      textAlign: 'center',
      transform: [
        {
          rotate,
        },
        {
          scale,
        },
      ],
    };
  });
  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={[styles.pressable, { padding }]}
        onPress={onPress}
        disabled={disabled}
        android_ripple={
          onPress
            ? { color: Color(theme.primary).alpha(0.12).string() }
            : undefined
        }
      >
        <AnimatedIcon
          name={name}
          size={size}
          color={disabled ? theme.outline : color || theme.onSurface}
          style={IconStyle}
        />
      </Pressable>
    </View>
  );
};
export default React.memo(AnimatedIconButton);

const styles = StyleSheet.create({
  container: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  pressable: {
    padding: 8,
  },
});
