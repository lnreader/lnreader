/**
 * Shared contract between the live reader, the reader settings preview, and
 * the EPUB exporter for what custom CSS/JS is allowed to see. Keeping the
 * bootstrap generation here means all three renderers expose the same
 * `window.LNReader` API and the same backward-compatible variables instead
 * of maintaining separate handwritten copies that can drift apart.
 */

export const LN_READER_API_VERSION = 1;
export const CHAPTER_ELEMENT_ID = 'LNReader-chapter';

export type ReaderCustomizationContext = {
  sourceId?: string;
  novelId?: number;
  novelName?: string;
  chapterId: number;
  chapterName: string;
};

export type CustomizationScriptKind = 'user-js' | 'plugin-js';

export interface CustomizationErrorEvent {
  kind: CustomizationScriptKind;
  message: string;
  stack?: string;
}

const JS_LINE_SEPARATOR = String.fromCharCode(0x2028);
const JS_PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * JSON.stringify does not escape `<`/`>`, so a name containing `</script>`
 * would otherwise be able to terminate the inline <script> tag it's embedded
 * in. U+2028/U+2029 are valid in JSON strings but were historically illegal
 * in JS source, so they're escaped too for older engine safety.
 */
export function serializeForInlineScript(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .split(JS_LINE_SEPARATOR)
    .join('\\u2028')
    .split(JS_PARAGRAPH_SEPARATOR)
    .join('\\u2029');
}

/**
 * Wraps a user-authored customization script so a thrown error is reported
 * instead of silently aborting. Safe to call in contexts without a
 * ReactNativeWebView bridge (e.g. an exported EPUB) - the postMessage call
 * is guarded and simply becomes a no-op there.
 */
export function wrapCustomizationScript(
  code: string | undefined,
  kind: CustomizationScriptKind,
): string {
  if (!code || !code.trim()) {
    return '';
  }
  const serializedKind = serializeForInlineScript(kind);
  return `try {
${code}
} catch (error) {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'customization-error',
      data: {
        kind: ${serializedKind},
        message: String((error && error.message) || error),
        stack: error && error.stack ? String(error.stack) : undefined,
      },
    }));
  }
  if (window.console && window.console.error) {
    window.console.error('[LNReader] Custom ' + ${serializedKind} + ' failed:', error);
  }
}`;
}

export interface BuildLNReaderApiScriptOptions {
  chapterElementId?: string;
  /**
   * Absolute URL of the plugin's external custom.js file, if any. Runtime
   * errors thrown by an externally loaded <script src> can't be caught with
   * try/catch, so they're attributed via the standard `error` event's
   * `filename`, matched against this URL, instead.
   */
  pluginScriptUrl?: string;
}

/**
 * Builds the bootstrap script shared by the live reader and the settings
 * preview: it defines `window.LNReader`, the six backward-compatible
 * variables, and the CSS dataset/id hooks - all derived from a single
 * `context`, so nothing here can drift from what's documented.
 */
export function buildLNReaderApiScript(
  context: ReaderCustomizationContext,
  {
    chapterElementId = CHAPTER_ELEMENT_ID,
    pluginScriptUrl,
  }: BuildLNReaderApiScriptOptions = {},
): string {
  const pluginErrorListener = pluginScriptUrl
    ? `
window.addEventListener('error', function (event) {
  if (event && event.filename === ${serializeForInlineScript(
    pluginScriptUrl,
  )}) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'customization-error',
        data: {
          kind: 'plugin-js',
          message: event.message || 'Plugin script failed',
          stack: event.error && event.error.stack ? String(event.error.stack) : undefined,
        },
      }));
    }
    if (window.console && window.console.error) {
      window.console.error('[LNReader] Custom plugin-js failed:', event.error || event.message);
    }
  }
});`
    : '';

  return `${pluginErrorListener}
window.LNReader = Object.freeze({
  apiVersion: ${LN_READER_API_VERSION},
  context: Object.freeze(${serializeForInlineScript(context)}),
  chapter: Object.freeze({
    root: document.getElementById(${serializeForInlineScript(
      chapterElementId,
    )}) || document.body,
    getHTML: function () {
      return this.root ? this.root.innerHTML : '';
    },
  }),
});

var sourceId = LNReader.context.sourceId;
var novelId = LNReader.context.novelId;
var novelName = LNReader.context.novelName;
var chapterId = LNReader.context.chapterId;
var chapterName = LNReader.context.chapterName;
var html = LNReader.chapter.getHTML();

if (sourceId !== undefined && sourceId !== null) {
  document.body.dataset.sourceId = String(sourceId);
  document.body.id = 'sourceId-' + sourceId;
}
if (novelId !== undefined && novelId !== null) {
  document.body.dataset.novelId = String(novelId);
}
document.body.dataset.chapterId = String(chapterId);
`;
}

/**
 * EPUB pages are static documents that all share the same injected script,
 * so - unlike the live reader/preview - chapterId/chapterName can't be
 * baked in at build time. They're read from the per-page DOM instead
 * (`data-chapter-id` is written by the native exporter, `document.title` is
 * the chapter title), while sourceId/novelId/novelName are constant for the
 * whole book and can be embedded directly.
 */
export function buildEpubLNReaderApiScript(
  novelContext: Pick<
    ReaderCustomizationContext,
    'sourceId' | 'novelId' | 'novelName'
  >,
): string {
  return `window.LNReader = Object.freeze({
  apiVersion: ${LN_READER_API_VERSION},
  context: Object.freeze({
    sourceId: ${serializeForInlineScript(novelContext.sourceId)},
    novelId: ${serializeForInlineScript(novelContext.novelId)},
    novelName: ${serializeForInlineScript(novelContext.novelName)},
    chapterId: Number(document.body.dataset.chapterId),
    chapterName: document.title,
  }),
  chapter: Object.freeze({
    root: document.body,
    getHTML: function () {
      return this.root ? this.root.innerHTML : '';
    },
  }),
});

var sourceId = LNReader.context.sourceId;
var novelId = LNReader.context.novelId;
var novelName = LNReader.context.novelName;
var chapterId = LNReader.context.chapterId;
var chapterName = LNReader.context.chapterName;
var html = LNReader.chapter.getHTML();

if (sourceId !== undefined && sourceId !== null) {
  document.body.dataset.sourceId = String(sourceId);
  document.body.id = 'sourceId-' + sourceId;
}
if (novelId !== undefined && novelId !== null) {
  document.body.dataset.novelId = String(novelId);
}
`;
}
