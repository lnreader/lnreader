import { requireNativeModule, NativeModule } from 'expo-modules-core';

type NativeTTSMediaControlEvents = {
  TTSPlay: () => void;
  TTSPause: () => void;
  TTSStop: () => void;
  TTSPrev: () => void;
  TTSNext: () => void;
  TTSRewind: () => void;
  TTSSeekTo: (params: { position: number }) => void;
};

declare class NativeTTSMediaControl extends NativeModule<NativeTTSMediaControlEvents> {
  showMediaNotification(
    title: string,
    subtitle: string,
    coverUri: string,
    playing: boolean,
  ): void;
  updatePlaybackState(playing: boolean): void;
  updateProgress(current: number, total: number): void;
  dismiss(): void;
}

export default requireNativeModule<NativeTTSMediaControl>('NativeTTSMediaControl');