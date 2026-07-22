import { requireNativeModule } from 'expo-modules-core';

type NativeTTSMediaControlModule = {
  showMediaNotification(
    title: string,
    subtitle: string,
    coverUri: string,
    playing: boolean,
  ): void;
  updatePlaybackState(playing: boolean): void;
  updateProgress(current: number, total: number): void;
  dismiss(): void;
};

export default requireNativeModule<NativeTTSMediaControlModule>(
  'NativeTTSMediaControl',
);