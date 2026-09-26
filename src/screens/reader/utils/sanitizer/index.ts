import * as cheerio from 'cheerio';
import { stripHiddenElements } from './invisibility';
import { flattenInlineElements, normalizeTtsText } from './flattener';
import { deduplicateAdjacentParagraphs } from './deduplication';
import { evaluateAnomalyGate } from './anomalyGate';
import { applyNovelProfile } from './profileApplier';
import type { SanitizeOptions, SanitizeResult } from './types';

export * from './types';
export * from './invisibility';
export * from './flattener';
export * from './deduplication';
export * from './anomalyGate';
export * from './profileApplier';

/**
 * Main deterministic chapter sanitization pipeline.
 *
 * Runs:
 * 1. Novel profile rules (if provided)
 * 2. Invisibility stripping (display:none, font-size:0, visibility:hidden, offscreen)
 * 3. TTS inline text coalescing (unwrapping fragmented spans, cleaning zero-width chars)
 * 4. Sliding-window paragraph deduplication (anti-double-reading honeypots)
 * 5. Anomaly Detection Gate (duplication check, lorem ipsum check, word collapse)
 *
 * @param rawHtml The scraped HTML payload of the chapter
 * @param options Sanitization options and optional NovelProfile
 * @returns Clean HTML, clean TTS text, and the AnomalyReport
 */
export function sanitizeChapter(
  rawHtml: string,
  options?: SanitizeOptions,
): SanitizeResult {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return {
      cleanHtml: '',
      cleanText: '',
      isClean: false,
      anomalyReport: {
        isAnomaly: true,
        reasons: ['Empty or non-string chapter payload received'],
        metrics: {
          duplicateSentenceRatio: 0,
          duplicateParagraphRatio: 0,
          loremIpsumHits: 0,
          wordCount: 0,
          rawPayloadSize: 0,
          wordToLengthRatio: 0,
          ttsHazardCount: 0,
          entropyAnomaly: false,
        },
        sampleSuspects: [],
        timestamp: Date.now(),
      },
    };
  }

  // Load DOM into Cheerio without injecting <html><head> wrappers
  const $ = cheerio.load(rawHtml, null, false);

  // 1. Apply novel-specific profile rules first if available
  if (options?.profile) {
    applyNovelProfile($, options.profile);
  }

  // 2. Strip CSS / attribute hidden traps
  if (options?.stripHiddenElements !== false) {
    stripHiddenElements($);
  }

  // 3. Coalesce fragmented inline spans for TTS continuity
  if (options?.flattenInlineSpans !== false) {
    flattenInlineElements($);
  }

  // 4. Run sliding-window deduplication for adjacent duplicate paragraphs
  if (options?.deduplicateAdjacent !== false) {
    const windowSize = options?.dedupWindowSize ?? 2;
    const threshold = options?.dedupSimilarityThreshold ?? 0.95;
    deduplicateAdjacentParagraphs($, windowSize, threshold);
  }

  const cleanHtml = $.html() || '';

  let rawText = '';
  const paragraphs = $('p');
  if (paragraphs.length > 0) {
    const pTexts: string[] = [];
    paragraphs.each((_, p) => {
      const text = $(p).text();
      if (text && text.trim()) {
        pTexts.push(text.trim());
      }
    });
    rawText = pTexts.join('\n\n');
  } else {
    rawText = $('body').length > 0 ? $('body').text() : $.text();
  }

  const cleanText = normalizeTtsText(rawText);

  const anomalyReport = evaluateAnomalyGate(rawHtml, cleanText, options);

  return {
    cleanHtml,
    cleanText,
    anomalyReport,
    isClean: !anomalyReport.isAnomaly,
  };
}
