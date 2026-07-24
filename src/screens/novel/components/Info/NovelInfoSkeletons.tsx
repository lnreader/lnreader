import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Row } from '@components/Common';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const useShimmer = (theme: ThemeColors) => {
  const translateX = useSharedValue(-100);
  const [highlightColor, backgroundColor, disableLoadingAnimations] =
    useLoadingColors(theme);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: (translateX.value + '%') as `${number}%`,
      },
    ],
  }));

  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = -100;
    if (!disableLoadingAnimations) {
      translateX.value = withRepeat(
        withTiming(200, { duration: 1000 }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(translateX);
  }, [disableLoadingAnimations, translateX]);

  return {
    animatedStyle,
    highlightColor,
    backgroundColor,
    disableLoadingAnimations,
  };
};

export const ChapterCountSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const shimmer = useShimmer(theme);

  return (
    <View
      style={[
        styles.chapterCountSkeleton,
        { backgroundColor: shimmer.backgroundColor },
      ]}
    >
      {!shimmer.disableLoadingAnimations ? (
        <AnimatedLinearGradient
          start={[0, 0]}
          end={[1, 0]}
          locations={[0, 0.3, 0.7, 1]}
          style={[styles.chapterCountGradient, shimmer.animatedStyle]}
          colors={[
            'transparent',
            shimmer.highlightColor,
            shimmer.highlightColor,
            'transparent',
          ]}
        />
      ) : null}
    </View>
  );
};

export const NovelDetailsSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const shimmer = useShimmer(theme);
  const gradient = !shimmer.disableLoadingAnimations ? (
    <AnimatedLinearGradient
      start={[0, 0]}
      end={[1, 0]}
      locations={[0, 0.3, 0.7, 1]}
      style={[styles.infoSkeletonGradient, shimmer.animatedStyle]}
      colors={[
        'transparent',
        shimmer.highlightColor,
        shimmer.highlightColor,
        'transparent',
      ]}
    />
  ) : null;

  return (
    <>
      {[styles.w130, styles.w180].map((widthStyle, index) => (
        <Row key={index} style={styles.infoRow}>
          <View
            style={[
              styles.infoSkeletonBar,
              widthStyle,
              { backgroundColor: shimmer.backgroundColor },
            ]}
          >
            {gradient}
          </View>
        </Row>
      ))}
    </>
  );
};

export const ButtonGroupSkeleton = ({ theme }: { theme: ThemeColors }) => {
  const shimmer = useShimmer(theme);
  const gradient = !shimmer.disableLoadingAnimations ? (
    <AnimatedLinearGradient
      start={[0, 0]}
      end={[1, 0]}
      locations={[0, 0.3, 0.7, 1]}
      style={[styles.buttonSkeletonGradient, shimmer.animatedStyle]}
      colors={[
        'transparent',
        shimmer.highlightColor,
        shimmer.highlightColor,
        'transparent',
      ]}
    />
  ) : null;

  return (
    <View style={styles.buttonGroupSkeletonContainer}>
      {[0, 1].map(index => (
        <View
          key={index}
          style={[
            styles.buttonSkeleton,
            { backgroundColor: shimmer.backgroundColor },
          ]}
        >
          {gradient}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  buttonGroupSkeletonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    paddingTop: 8,
  },
  buttonSkeleton: {
    borderRadius: 8,
    flex: 1,
    height: 52,
    overflow: 'hidden',
  },
  buttonSkeletonGradient: {
    height: 60,
    position: 'absolute',
    width: '60%',
  },
  chapterCountGradient: {
    height: 20,
    position: 'absolute',
    width: '60%',
  },
  chapterCountSkeleton: {
    borderRadius: 4,
    height: 14,
    marginHorizontal: 16,
    overflow: 'hidden',
    width: 120,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoSkeletonBar: {
    borderRadius: 4,
    height: 14,
    overflow: 'hidden',
  },
  infoSkeletonGradient: {
    height: 20,
    position: 'absolute',
    width: '60%',
  },
  w130: {
    width: 130,
  },
  w180: {
    width: 180,
  },
});
