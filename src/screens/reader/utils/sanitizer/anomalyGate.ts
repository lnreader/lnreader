import type {
  AnomalyMetrics,
  AnomalyReport,
  SanitizeOptions,
} from './types';

/**
 * Standard filler / pseudo-latin seeds injected by aggregators and honey-pots.
 */
const LOREM_IPSUM_PATTERNS = [
  /\blorem\s+ipsum\b/i,
  /\bdolor\s+sit\s+amet\b/i,
  /\bconsectetur\s+adipiscing\b/i,
  /\bsed\s+do\s+eiusmod\s+tempor\b/i,
  /\but\s+labore\s+et\s+dolore\b/i,
  /\bquis\s+nostrud\s+exercitation\b/i,
  /\bullamco\s+laboris\s+nisi\b/i,
  /\bduis\s+aute\s+irure\b/i,
  /\bexcepteur\s+sint\s+occaecat\b/i,
  /\bcupidatat\s+non\s+proident\b/i,
];

/**
 * Scans text for pseudo-Latin and honey-pot seeds.
 */
export function scanLoremIpsum(text: string): {
  count: number;
  matches: string[];
} {
  let count = 0;
  const matches: string[] = [];

  for (const regex of LOREM_IPSUM_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      count++;
      matches.push(match[0]);
    }
  }

  return { count, matches };
}

/**
 * Calculates sentence-level duplication ratio across the text.
 */
export function calculateSentenceDuplication(text: string): {
  ratio: number;
  duplicateCount: number;
  totalSentences: number;
  duplicateSamples: string[];
} {
  // Split into sentences
  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Focus on substantive sentences

  if (rawSentences.length < 5) {
    return {
      ratio: 0,
      duplicateCount: 0,
      totalSentences: rawSentences.length,
      duplicateSamples: [],
    };
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let duplicateOccurrences = 0;

  for (const sentence of rawSentences) {
    const normalized = sentence.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (seen.has(normalized)) {
      duplicates.add(sentence);
      duplicateOccurrences++;
    } else {
      seen.add(normalized);
    }
  }

  const ratio = duplicateOccurrences / rawSentences.length;
  return {
    ratio,
    duplicateCount: duplicateOccurrences,
    totalSentences: rawSentences.length,
    duplicateSamples: Array.from(duplicates).slice(0, 3),
  };
}

/**
 * Checks for high character entropy or cipher-shifted text.
 */
export function checkEntropyAnomaly(text: string): boolean {
  if (text.length < 100) return false;

  // Ratio of printable ASCII/alphanumerics vs odd unicode symbols
  const alphanumericCount = (text.match(/[\p{L}\p{N}\s.,!?'"–—\-]/gu) || [])
    .length;
  const alphanumericRatio = alphanumericCount / text.length;

  // If less than 75% of characters are standard text/punctuation, likely ciphered or corrupted
  return alphanumericRatio < 0.75;
}

/**
 * Evaluates the parsed chapter content against anomaly detection thresholds.
 */
export function evaluateAnomalyGate(
  rawHtml: string,
  cleanText: string,
  options?: SanitizeOptions,
): AnomalyReport {
  const thresholds = {
    maxDuplicateRatio: options?.anomalyThresholds?.maxDuplicateRatio ?? 0.2,
    maxLoremIpsumHits: options?.anomalyThresholds?.maxLoremIpsumHits ?? 1,
    minWordCount: options?.anomalyThresholds?.minWordCount ?? 120,
    minWordToLengthRatio:
      options?.anomalyThresholds?.minWordToLengthRatio ?? 0.015,
  };

  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const rawPayloadSize = rawHtml.length;
  const wordToLengthRatio = rawPayloadSize > 0 ? wordCount / rawPayloadSize : 0;

  // 1. Check Lorem Ipsum / Honey-pots
  const loremResult = scanLoremIpsum(cleanText);

  // 2. Check Sentence Duplication (Double-TTS flag)
  const dupResult = calculateSentenceDuplication(cleanText);

  // 3. Check Entropy / Corruption
  const isEntropyCorrupted = checkEntropyAnomaly(cleanText);

  const reasons: string[] = [];
  const sampleSuspects: string[] = [];

  // Evaluate flags
  if (loremResult.count >= thresholds.maxLoremIpsumHits) {
    reasons.push(
      `Lorem ipsum or honey-pot text detected (${loremResult.count} matches)`,
    );
    sampleSuspects.push(...loremResult.matches);
  }

  if (dupResult.ratio >= thresholds.maxDuplicateRatio) {
    reasons.push(
      `High duplicate sentence ratio (${(dupResult.ratio * 100).toFixed(1)}% >= ${(thresholds.maxDuplicateRatio * 100).toFixed(1)}%) — TTS double-reading hazard`,
    );
    sampleSuspects.push(...dupResult.duplicateSamples);
  }

  // Length collapse: HTML was > 15KB but extracted text is tiny
  if (rawPayloadSize > 15000 && wordCount < thresholds.minWordCount) {
    reasons.push(
      `Word count collapse: Raw HTML payload was ${rawPayloadSize} bytes but only yielded ${wordCount} words (minimum: ${thresholds.minWordCount})`,
    );
  }

  // Payload density collapse
  if (
    rawPayloadSize > 25000 &&
    wordToLengthRatio < thresholds.minWordToLengthRatio
  ) {
    reasons.push(
      `Extremely low word-to-payload density (${(wordToLengthRatio * 100).toFixed(2)}%) — Content likely trapped in unparsed selectors`,
    );
  }

  if (isEntropyCorrupted) {
    reasons.push(
      'High character entropy anomaly — Possible cipher-shifted or corrupted text',
    );
  }

  const isAnomaly = reasons.length > 0;

  const metrics: AnomalyMetrics = {
    duplicateSentenceRatio: dupResult.ratio,
    duplicateParagraphRatio:
      dupResult.duplicateCount / (dupResult.totalSentences || 1),
    loremIpsumHits: loremResult.count,
    wordCount,
    rawPayloadSize,
    wordToLengthRatio,
    ttsHazardCount: dupResult.duplicateCount + loremResult.count,
    entropyAnomaly: isEntropyCorrupted,
  };

  return {
    isAnomaly,
    reasons,
    metrics,
    sampleSuspects,
    timestamp: Date.now(),
  };
}
