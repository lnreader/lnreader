/**
 * Type definitions for the Deterministic Novel DOM Sanitizer & Anomaly Gate.
 */

export interface NovelProfile {
  novelId?: string;
  domain?: string;
  excludeSelectors?: string[];
  stripRegexes?: string[];
  deduplicateAdjacent?: boolean;
  flattenInlineSpans?: boolean;
  stripHiddenStyles?: boolean;
  version?: number;
  metadata?: Record<string, unknown>;
}

export interface AnomalyMetrics {
  duplicateSentenceRatio: number;
  duplicateParagraphRatio: number;
  loremIpsumHits: number;
  wordCount: number;
  rawPayloadSize: number;
  wordToLengthRatio: number;
  ttsHazardCount: number;
  entropyAnomaly: boolean;
}

export interface AnomalyReport {
  isAnomaly: boolean;
  reasons: string[];
  metrics: AnomalyMetrics;
  sampleSuspects: string[];
  timestamp: number;
}

export interface SanitizeOptions {
  /** Apply novel-specific rules if available */
  profile?: NovelProfile;
  /** Strip elements with display:none, font-size:0, visibility:hidden, etc. Default: true */
  stripHiddenElements?: boolean;
  /** Flatten fragmented inline spans to prevent TTS stutter. Default: true */
  flattenInlineSpans?: boolean;
  /** Deduplicate adjacent cloned paragraphs (fixes double-TTS trap). Default: true */
  deduplicateAdjacent?: boolean;
  /** Sliding window size for deduplication. Default: 2 */
  dedupWindowSize?: number;
  /** Jaccard similarity threshold for considering two paragraphs clones. Default: 0.85 */
  dedupSimilarityThreshold?: number;
  /** Anomaly gate thresholds */
  anomalyThresholds?: {
    maxDuplicateRatio?: number; // default: 0.20
    maxLoremIpsumHits?: number; // default: 1
    minWordCount?: number; // default: 120
    minWordToLengthRatio?: number; // default: 0.015 for payloads > 10KB
  };
}

export interface SanitizeResult {
  /** Clean HTML ready for LNReader WebView rendering */
  cleanHtml: string;
  /** Flat plain text ready for TTS engine traversal */
  cleanText: string;
  /** Health metrics and anomaly diagnostics */
  anomalyReport: AnomalyReport;
  /** True if no anomalies were tripped and output is safe */
  isClean: boolean;
}
