import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// The softest tick Android offers, made for rapid series (Android 14+; the
// clock tick before).
export const sliderTick = () => {
  const tick =
    Number(Platform.Version) >= 34
      ? Haptics.AndroidHaptics.Segment_Frequent_Tick
      : Haptics.AndroidHaptics.Clock_Tick;
  Haptics.performAndroidHapticsAsync(tick).catch(() => {});
};
