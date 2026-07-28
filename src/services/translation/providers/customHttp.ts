/**
 * Custom HTTP — the generalised escape hatch (spec §6.4).
 *
 * Covers any provider not integrated explicitly: the user describes the
 * request shape with placeholders and says where the translated text lives in
 * the response. Nothing here knows about any particular vendor.
 */
import {
  TranslationError,
  type CustomHttpConfig,
  type TranslationProvider,
} from '../types';
import { requestJson } from './http';

/**
 * Resolves a dotted path such as `data.translations.0.text`.
 *
 * Numeric segments index into arrays. Returns undefined for any miss rather
 * than throwing, so the caller can produce one error message naming the whole
 * path — far more useful to someone debugging their own template than a
 * failure on an intermediate segment.
 */
export const resolveJsonPath = (source: unknown, path: string): unknown => {
  if (!path) {
    return source;
  }
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current == null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

/** Best-effort human-readable language name for `{source_name}`/`{target_name}`. */
export const languageDisplayName = (code: string): string => {
  if (!code || code === 'auto') {
    return 'auto';
  }
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    // Intl.DisplayNames is not guaranteed on every Hermes build.
    return code;
  }
};

interface TemplateValues {
  texts: string[];
  /** The single segment, for `{text}` templates. */
  text: string;
  sourceLang: string;
  targetLang: string;
}

/**
 * Substitutes placeholders into a template.
 *
 * `{texts}` and `{text_esc}` produce JSON-escaped output so the result is
 * still valid JSON when the placeholder sits inside a quoted string; `{text}`
 * is raw, which is what makes it usable outside JSON (query strings, form
 * bodies).
 */
export const fillHttpTemplate = (
  template: string,
  values: TemplateValues,
): string =>
  template
    .replaceAll('{texts}', JSON.stringify(values.texts))
    .replaceAll('{text_esc}', JSON.stringify(values.text).slice(1, -1))
    .replaceAll('{text}', values.text)
    .replaceAll('{source_name}', languageDisplayName(values.sourceLang))
    .replaceAll('{target_name}', languageDisplayName(values.targetLang))
    .replaceAll('{source}', values.sourceLang)
    .replaceAll('{target}', values.targetLang);

const parseHeaders = (
  headersTemplate: string,
  apiKey: string | undefined,
): Record<string, string> => {
  const rendered = (headersTemplate || '{}').replaceAll(
    '{apiKey}',
    apiKey ?? '',
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(rendered);
  } catch {
    throw new TranslationError(
      'config',
      'Custom HTTP headers are not valid JSON.',
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TranslationError(
      'config',
      'Custom HTTP headers must be a JSON object.',
    );
  }
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  );
};

const extractString = (
  body: unknown,
  path: string,
  context: string,
): string => {
  const value = resolveJsonPath(body, path);
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new TranslationError(
    'bad-response',
    `Custom HTTP: no text found at "${path}"${context}.`,
  );
};

export const customHttpProvider: TranslationProvider<CustomHttpConfig> = {
  id: 'customhttp',
  isLocal: false,
  // Whether a key is needed depends entirely on the user's own template, so
  // it is never demanded up front — an unused `{apiKey}` simply renders empty.
  requiresApiKey: () => false,
  defaultConfig: {
    provider: 'customhttp',
    url: '',
    method: 'POST',
    headersTemplate: '{\n  "Authorization": "Bearer {apiKey}"\n}',
    bodyTemplate:
      '{\n  "q": {texts},\n  "source": "{source}",\n  "target": "{target}"\n}',
    responsePath: 'translatedText',
  },
  translateBatch: async (texts, ctx) => {
    const { config, apiKey, sourceLang, targetLang, signal } = ctx;

    if (!config.url) {
      throw new TranslationError('config', 'Custom HTTP: no URL configured.');
    }

    const headers = parseHeaders(config.headersTemplate, apiKey);
    const batched = config.bodyTemplate.includes('{texts}');

    const send = async (payloadTexts: string[], singleText: string) => {
      const values: TemplateValues = {
        texts: payloadTexts,
        text: singleText,
        sourceLang,
        targetLang,
      };
      return requestJson<unknown>(fillHttpTemplate(config.url, values), {
        method: config.method,
        body: fillHttpTemplate(config.bodyTemplate, values),
        headers,
        signal,
      });
    };

    if (batched) {
      const body = await send(texts, texts[0] ?? '');
      const value = resolveJsonPath(body, config.responsePath);

      if (!Array.isArray(value)) {
        // A batch template must yield one result per input. Anything else
        // cannot be aligned with the source, so it fails loudly rather than
        // being spread across the chunk.
        throw new TranslationError(
          'bad-response',
          `Custom HTTP: expected an array at "${config.responsePath}" for a {texts} template.`,
        );
      }
      if (value.length !== texts.length) {
        throw new TranslationError(
          'bad-response',
          `Custom HTTP returned ${value.length} results for ${texts.length} inputs.`,
        );
      }
      return value.map(entry =>
        typeof entry === 'string' ? entry : String(entry),
      );
    }

    // A `{text}` template addresses one segment per request, so the chunk is
    // walked sequentially. Users on such an endpoint should keep the chunk
    // size low, since the configured inter-request delay paces chunks rather
    // than the requests inside one.
    const results: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (signal.aborted) {
        throw new TranslationError('timeout', 'Translation request timed out.');
      }
      const body = await send([texts[i]], texts[i]);
      results.push(
        extractString(body, config.responsePath, ` for segment ${i + 1}`),
      );
    }
    return results;
  },
};
