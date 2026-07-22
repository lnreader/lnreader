import { requireNativeModule } from 'expo-modules-core';

type NativeVolumeButtonListenerModule = {
  setActive(active: boolean): void;
};

export default requireNativeModule<NativeVolumeButtonListenerModule>(
  'NativeVolumeButtonListener',
);