import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type NativeShareReceiverEvents = {
  SharedText: (payload: { text: string }) => void;
};

declare class NativeShareReceiverModule extends NativeModule<NativeShareReceiverEvents> {
  getInitialSharedText(): string | null;
}

export default requireNativeModule<NativeShareReceiverModule>(
  'NativeShareReceiver',
);
