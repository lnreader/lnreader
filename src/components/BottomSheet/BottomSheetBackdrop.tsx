import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useBottomSheet } from '@gorhom/bottom-sheet';
import { BottomSheetBackdropProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import Color from 'color';

import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CustomBackdrop = ({ style }: BottomSheetBackdropProps) => {
  const { close } = useBottomSheet();
  const theme = useTheme();

  return (
    <AnimatedPressable
      accessibilityLabel={getString('common.cancel')}
      accessibilityRole="button"
      onPress={() => close()}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[
        styles.container,
        style,
        { backgroundColor: Color(theme.scrim).alpha(0.32).string() },
      ]}
    />
  );
};
export default memo(CustomBackdrop);
