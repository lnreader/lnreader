/**
 * Shared HTTP plumbing for translation providers.
 *
 * Centralises the mapping from transport/status failures onto
 * `TranslationError` kinds, so the orchestrator can decide what is worth
 * retrying without every provider re-deriving that classification.
 */
import { TranslationError } from '../types';

export const postJson = async <T>(
  url: string,
  body: unknown,
  init: { headers?: Record<string, string>; signal: AbortSignal },
): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      body: JSON.stringify(body),
      signal: init.signal,
    });
  } catch (e) {
    // An aborted request is the timeout the orchestrator armed, not a
    // network fault; the distinction matters for the retry decision.
    if (init.signal.aborted) {
      throw new TranslationError('timeout', 'Translation request timed out.');
    }
    throw new TranslationError(
      'network',
      e instanceof Error ? e.message : 'Network request failed.',
    );
  }

  if (!response.ok) {
    throw new TranslationError(
      classifyStatus(response.status),
      `Provider responded ${response.status}: ${await safeText(response)}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new TranslationError(
      'bad-response',
      'Provider returned a response that was not valid JSON.',
    );
  }
};

const classifyStatus = (status: number) => {
  if (status === 401 || status === 403) {
    return 'auth' as const;
  }
  if (status === 429) {
    return 'rate-limit' as const;
  }
  if (status >= 500) {
    return 'network' as const;
  }
  return 'bad-response' as const;
};

/** Response bodies are best-effort context for the error message only. */
const safeText = async (response: Response): Promise<string> => {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return '<unreadable body>';
  }
};

/** Trailing slashes in user-entered server URLs are the norm, not an error. */
export const trimTrailingSlash = (url: string): string =>
  url.replace(/\/+$/, '');
