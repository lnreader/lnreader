/**
 * Core contracts for the in-app chapter translation feature.
 *
 * See `docs/specs/chapter-translation.md`. Two constraints from the spec drive
 * the shape of everything here:
 *
 * - Providers sit behind one interface from day one, so adding the Phase 2
 *   provider list is a new file rather than a change to the call sites.
 * - Provider settings are a single discriminated union keyed on `provider`,
 *   not a flat bag of `<vendor>ApiKey` fields that all coexist. Only the
 *   active provider's config is ever held.
 *
 * API keys are deliberately *absent* from these config objects — they live in
 * the encrypted store (`secureStorage.ts`) and are injected into the provider
 * at call time via `TranslateContext.apiKey`.
 */

/** Providers shipped in Phase 1. Phase 2 extends this union. */
export type TranslationProviderId = 'libretranslate' | 'gemini' | 'ollama';

/**
 * `auto` asks the provider to detect the source language. Everything else is
 * an ISO-639-1 code. Kept as a plain string because the set of codes a given
 * provider accepts varies and is validated provider-side, not here.
 */
export type SourceLanguage = 'auto' | string;

export interface LibreTranslateConfig {
  provider: 'libretranslate';
  /** Instance base URL. Public instances are free; self-hosted needs no key. */
  endpoint: string;
  /** Whether this instance requires an API key (public ones generally don't). */
  requiresApiKey: boolean;
}

export interface GeminiConfig {
  provider: 'gemini';
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export interface OllamaConfig {
  provider: 'ollama';
  /** Base URL of the user's Ollama server, e.g. `http://192.168.1.10:11434`. */
  endpoint: string;
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export type TranslationConfig =
  | LibreTranslateConfig
  | GeminiConfig
  | OllamaConfig;

/** Narrows the union to the member matching a given provider id. */
export type ConfigFor<Id extends TranslationProviderId> = Extract<
  TranslationConfig,
  { provider: Id }
>;

/**
 * Everything a provider needs for one `translateBatch` call that isn't part of
 * its persisted config. The api key arrives here rather than in the config so
 * it is never accidentally serialised into plain settings storage.
 */
export interface TranslateContext<C extends TranslationConfig> {
  config: C;
  /** Decrypted key, or undefined for providers that don't need one. */
  apiKey?: string;
  sourceLang: SourceLanguage;
  targetLang: string;
  /** Aborts the in-flight request once the configured timeout elapses. */
  signal: AbortSignal;
}

/**
 * A translation backend.
 *
 * `translateBatch` receives an array of paragraph strings and MUST return an
 * array of the same length in the same order. Returning a different length is
 * treated as a provider error by the orchestrator rather than being silently
 * padded, because a length mismatch means paragraphs have been merged or
 * dropped and the result can no longer be aligned with the source document.
 */
export interface TranslationProvider<
  C extends TranslationConfig = TranslationConfig,
> {
  id: C['provider'];
  /** Whether an API key must be present before this provider can be used. */
  requiresApiKey: (config: C) => boolean;
  /**
   * True for engines running on the user's own hardware. Only local engines
   * are eligible for the parallelism control in Phase 3 — rate-limited cloud
   * APIs stay sequential.
   */
  isLocal: boolean;
  /** Config used when the user first selects this provider. */
  defaultConfig: C;
  translateBatch: (
    texts: string[],
    ctx: TranslateContext<C>,
  ) => Promise<string[]>;
}

/** Distinguishes a retryable failure from one that will fail again identically. */
export type TranslationErrorKind =
  | 'auth' // bad/missing key — retrying won't help
  | 'rate-limit' // backoff and retry
  | 'timeout' // retryable
  | 'network' // retryable
  | 'bad-response' // provider returned something unparseable
  | 'config'; // user config is invalid — retrying won't help

export class TranslationError extends Error {
  readonly kind: TranslationErrorKind;
  readonly retryable: boolean;

  constructor(kind: TranslationErrorKind, message: string) {
    super(message);
    this.name = 'TranslationError';
    this.kind = kind;
    this.retryable =
      kind === 'rate-limit' || kind === 'timeout' || kind === 'network';
  }
}
