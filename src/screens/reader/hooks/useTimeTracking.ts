import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';


/**
 * Starts tracking time spent on the chapter, and flushes the data to the database:
 * - periodically every minute
 * - when the app goes in the background
 * - when the chapter changes
 */
export default function useTimeTracking(
  chapterId: number,
  incognitoMode: boolean,
  increaseTimeSpent: (chapterId: number, elapsed: number) => void,
) {
  const startTimestampRef = useRef(Date.now());

  /** Increases the time spent on the current chapter since the last time this function was called */
  const flushElapsedTime = useCallback(() => {
    if (!incognitoMode) {
      const elapsed = Date.now() - startTimestampRef.current;
      if (elapsed > 0) {
        increaseTimeSpent(chapterId, elapsed);
      }
    }
    startTimestampRef.current = Date.now();
  }, [chapterId, incognitoMode, increaseTimeSpent]);

  // Flush the elapsed time every minute
  useEffect(() => {
    const intervalId = setInterval(flushElapsedTime, 60000);
    return () => clearInterval(intervalId);
  }, [flushElapsedTime]);

  // Flush the elapsed time when the app goes in the background
  useEffect(() => {
    let appState = AppState.currentState;
    const handleChange = (nextState: AppStateStatus) => {
      if (appState === 'active' && nextState.match(/inactive|background/)) {
        // Save the elapsed time when the app goes in the background
        flushElapsedTime();
      } else if (appState.match(/inactive|background/) && nextState === 'active') {
        // Reset the start timestamp when the app comes back
        startTimestampRef.current = Date.now();
      }
      appState = nextState;
    };
    const sub = AppState.addEventListener('change', handleChange);
    return () => sub.remove();
  }, [flushElapsedTime]);

  // Flush the elapsed time when the chapter changes
  useEffect(() => {
    startTimestampRef.current = Date.now();
    return () => {
      flushElapsedTime();
    };
  }, [chapterId, flushElapsedTime]);
}
