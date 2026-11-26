import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type NativeShareReceiverEvents = {
  SharedText: (payload: { text: string }) => void;
  EpubOpened: () => void;
};

declare class NativeShareReceiverModule extends NativeModule<NativeShareReceiverEvents> {
  getInitialSharedText(): string | null;
  takeOpenedEpubs?(): Promise<string[]>;
  stageOpenedEpub(uri: string): Promise<{ uri: string; filename: string }>;
}

export default requireNativeModule<NativeShareReceiverModule>(
  'NativeShareReceiver',
);
