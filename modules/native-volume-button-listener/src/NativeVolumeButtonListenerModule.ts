import { NativeModule, requireNativeModule } from 'expo-modules-core';

type NativeVolumeButtonListenerEvents = {
  VolumeUp: () => void;
  VolumeDown: () => void;
};

declare class NativeVolumeButtonListenerModule extends NativeModule<NativeVolumeButtonListenerEvents> {
  setActive(active: boolean): void;
}

export default requireNativeModule<NativeVolumeButtonListenerModule>(
  'NativeVolumeButtonListener',
);
