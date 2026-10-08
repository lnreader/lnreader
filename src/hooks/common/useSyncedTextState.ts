import { useEffect } from 'react';
import { useNativeState, type ObservableState } from '@expo/ui/jetpack-compose';

// Compose text fields keep their text in a native observable; this keeps it
// in step with a React-controlled string in both directions.
export const useSyncedTextState = (value: string): ObservableState<string> => {
  const state = useNativeState(value);
  useEffect(() => {
    if (state.value !== value) {
      // Writing `.value` pushes the text to the native observable.
      // eslint-disable-next-line react-hooks/immutability
      state.value = value;
    }
  }, [state, value]);
  return state;
};
