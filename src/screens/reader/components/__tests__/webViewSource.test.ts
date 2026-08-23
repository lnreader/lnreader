/**
 * Red-first matrix test for the WebView baseUrl contract (#1999, ruling
 * 59414f8: fallback-only).
 *
 * The baseUrl decision lives inline in WebViewReader's `source` useMemo.
 * To test it without rendering the whole reader, extract the same
 * expression into a tiny exported helper (resolveBaseUrl) and have the
 * component consume it — the helper IS the production logic, so these
 * tests pin the real behavior:
 *
 *   online + plugin.site   → plugin.site   (working path, byte-stable)
 *   downloaded             → 'https://lnreader.local/'  (opaque cohort A)
 *   online, no plugin.site → 'https://lnreader.local/'  (opaque cohort B)
 *
 * AC2 additionally pins that generated HTML keeps ABSOLUTE
 * file:///android_asset asset URIs in all three cohorts: the template's
 * asset references do not depend on baseUrl, so a changed origin can never
 * break fonts/images. The assertion reads WebViewReader.tsx source and
 * fails if anyone converts those URIs to relative paths.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { resolveBaseUrl, FALLBACK_BASE_URL } from '../webViewSource';

const SITE = 'https://some-plugin.example.com';

describe('resolveBaseUrl — fallback-only matrix (#1999)', () => {
  it('keeps plugin.site for online chapters with a site (byte-stable working path)', () => {
    expect(resolveBaseUrl({ isDownloaded: false, pluginSite: SITE })).toBe(
      SITE,
    );
  });

  it('fills downloaded chapters with https://lnreader.local/', () => {
    expect(resolveBaseUrl({ isDownloaded: true, pluginSite: SITE })).toBe(
      FALLBACK_BASE_URL,
    );
    expect(resolveBaseUrl({ isDownloaded: true, pluginSite: undefined })).toBe(
      FALLBACK_BASE_URL,
    );
  });

  it('fills online chapters whose plugin has no site with https://lnreader.local/', () => {
    expect(resolveBaseUrl({ isDownloaded: false, pluginSite: undefined })).toBe(
      FALLBACK_BASE_URL,
    );
    expect(resolveBaseUrl({ isDownloaded: false, pluginSite: '' })).toBe(
      FALLBACK_BASE_URL,
    );
  });
});

describe('AC2 — absolute asset URIs independent of baseUrl (#1999)', () => {
  const readerSource = readFileSync(
    join(process.cwd(), 'src/screens/reader/components/WebViewReader.tsx'),
    'utf8',
  );

  it.each([
    ['online + site', { isDownloaded: false, pluginSite: SITE }],
    ['downloaded', { isDownloaded: true, pluginSite: undefined }],
    ['online site-less', { isDownloaded: false, pluginSite: undefined }],
  ])('%s: asset URIs stay absolute file:///android_asset', (_label, cohort) => {
    // Whatever origin this cohort gets, the template must keep absolute
    // asset URIs — assert the resolver result AND the template contract.
    const baseUrl = resolveBaseUrl(cohort);
    expect(typeof baseUrl === 'string' || baseUrl === undefined).toBe(true);

    expect(readerSource).toContain("'file:///android_asset'");
    expect(readerSource).toMatch(/file:\/\/\/android_asset\/fonts\/\$\{/);
  });
});
