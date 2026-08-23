/**
 * WebView source helpers (#1999, ruling 59414f8: fallback-only baseUrl).
 *
 * resolveBaseUrl encodes the entire baseUrl matrix for the reader WebView:
 * online chapters with a plugin site keep their real origin (working path
 * — byte-stable, CORS/relative-link semantics untouched); the two opaque
 * cohorts (downloaded chapters, site-less plugins) get a fixed local origin
 * so storage/clipboard APIs and null-Origin quirks stop breaking.
 */

export const FALLBACK_BASE_URL = 'https://lnreader.local/';

export const resolveBaseUrl = ({
  isDownloaded,
  pluginSite,
}: {
  /** Chapter.isDownloaded is `boolean | null` at the DB layer. */
  isDownloaded: boolean | null | undefined;
  pluginSite?: string;
}): string | undefined => {
  // A null/unset flag behaves like "not downloaded" for origin purposes:
  // only a positively-downloaded chapter with no site falls back, and an
  // online chapter needs a positively-present site to keep it.
  if (!isDownloaded && pluginSite) {
    return pluginSite;
  }
  if (isDownloaded) {
    return FALLBACK_BASE_URL;
  }
  return pluginSite ? undefined : FALLBACK_BASE_URL;
};
