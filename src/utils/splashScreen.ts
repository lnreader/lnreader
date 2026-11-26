import * as SplashScreen from 'expo-splash-screen';

const FADE_DURATION_MS = 300;
/**
 * Upper bound on how long the splash may wait for the library to load, so a
 * slow or stuck query never leaves the app on the splash screen.
 */
const MAX_WAIT_AFTER_INIT_MS = 2500;

/**
 * Without this the splash hides itself as soon as React first draws anything,
 * which would expose half-initialised screens if the root ever renders early.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: FADE_DURATION_MS, fade: true });

let hidden = false;
let resolveHidden: () => void;
const hiddenPromise = new Promise<void>(resolve => {
  resolveHidden = resolve;
});
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

export const hideSplashScreen = () => {
  if (hidden) {
    return;
  }
  hidden = true;
  clearTimeout(fallbackTimer);
  SplashScreen.hide();
  setTimeout(() => resolveHidden(), FADE_DURATION_MS);
};

export const hideSplashScreenEventually = () => {
  if (hidden || fallbackTimer) {
    return;
  }
  fallbackTimer = setTimeout(hideSplashScreen, MAX_WAIT_AFTER_INIT_MS);
};

/**
 * Resolves once the splash has finished fading out. System bar styles applied
 * while it is still visible would be drawn over the splash background.
 */
export const whenSplashScreenHidden = () => hiddenPromise;
