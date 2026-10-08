import { NativeModules } from 'react-native';

const DEV_FALLBACK = 'http://localhost:8081';

// Release builds ship the assets in the APK; dev builds fetch them from the
// dev server the bundle came from (a device may reach it over the LAN).
export const getReaderAssetsUri = (): string => {
  if (!__DEV__) {
    return 'file:///android_asset';
  }
  const sourceCode = NativeModules.SourceCode as
    | { getConstants?: () => { scriptURL?: unknown }; scriptURL?: unknown }
    | undefined;
  const scriptURL =
    sourceCode?.getConstants?.().scriptURL ?? sourceCode?.scriptURL;
  const origin =
    typeof scriptURL === 'string'
      ? scriptURL.match(/^https?:\/\/[^/]+/)?.[0]
      : undefined;
  return `${origin ?? DEV_FALLBACK}/assets`;
};

// Fonts load in CORS mode, which the reader page (built from a string, so
// without an origin) may be refused over the network; the APK copies aren't.
export const READER_FONTS_URI = 'file:///android_asset';
