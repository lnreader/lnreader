import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeWidgetsModule = {
  /** Whether at least one LNReader widget is on the home screen. */
  hasWidgets(): Promise<boolean>;
  /** Stores the serialized `WidgetSnapshot` and re-renders every widget. */
  setSnapshot(json: string): Promise<void>;
  setLibraryUpdateState(
    running: boolean,
    done: number,
    total: number,
  ): Promise<void>;
};

// Android-only; null elsewhere so callers can no-op.
export default requireOptionalNativeModule<NativeWidgetsModule>(
  'NativeWidgets',
);
