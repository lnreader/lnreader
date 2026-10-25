import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeCloudflareModule = {
  /**
   * Runs the Cloudflare challenge for `url` in an off-screen WebView and
   * resolves `true` once a new `cf_clearance` cookie is stored.
   */
  solveChallenge(
    url: string,
    userAgent: string,
    timeoutMs: number,
  ): Promise<boolean>;
};

export default requireOptionalNativeModule<NativeCloudflareModule>(
  'NativeCloudflare',
);
