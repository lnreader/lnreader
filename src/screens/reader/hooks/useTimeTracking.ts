import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';


/**
 * Starts tracking time spent on the chapter and returns a callback to be called on user interaction (to prevent the inactivity timeout from being triggered).
 */
export default function useTimeTracking(
  chapterId: number,
  incognitoMode: boolean,
  inactivityTimeoutMs: number | undefined,
  turnedOn: boolean,
  increaseTimeSpent: (chapterId: number, elapsed: number) => void,
) {
  const lastUserInteractionRef = useRef(Date.now());
  const isTTSReadingRef = useRef(false);

  /** Increases the time spent on the current chapter since the last user interaction, as long as it was not too long ago */
  const flushElapsedTime = useCallback(() => {
    console.log("flushed");
    const enabled = turnedOn && !incognitoMode;
    const isInactive = inactivityTimeoutMs !== undefined && Date.now() - lastUserInteractionRef.current > inactivityTimeoutMs;
    if (enabled && (!isInactive || isTTSReadingRef.current)) {
      const elapsed = Date.now() - lastUserInteractionRef.current;
      if (elapsed > 0) {
        increaseTimeSpent(chapterId, elapsed);
      }
    }
  }, [chapterId, incognitoMode, inactivityTimeoutMs, turnedOn, increaseTimeSpent]);

  const onUserInteraction = useCallback(() => {
    flushElapsedTime();
    lastUserInteractionRef.current = Date.now();
  }, [flushElapsedTime]);

  // Flush the elapsed time when the app goes in the background
  useEffect(() => {
    let appState = AppState.currentState;
    const handleChange = (nextState: AppStateStatus) => {
      if (appState === 'active' && nextState.match(/inactive|background/)) {
        // Save the elapsed time when the app goes in the background
        flushElapsedTime();
        lastUserInteractionRef.current = Date.now();
      } else if (appState.match(/inactive|background/) && nextState === 'active') {
        // Reset the start timestamp when the app comes back and the TTS isn't on
        if (!isTTSReadingRef.current) {
          lastUserInteractionRef.current = Date.now();
        } else {
          // If TTS is on, we want to count the time spent in the background as well
          flushElapsedTime();
          lastUserInteractionRef.current = Date.now();
        }
      }
      appState = nextState;
    };
    const sub = AppState.addEventListener('change', handleChange);
    return () => sub.remove();
  }, [flushElapsedTime]);

  // Flush the elapsed time when the chapter changes
  useEffect(() => {
    lastUserInteractionRef.current = Date.now();
    return () => {
      flushElapsedTime();
    };
  }, [chapterId, flushElapsedTime]);
  return { onUserInteraction, isTTSReadingRef };
}
