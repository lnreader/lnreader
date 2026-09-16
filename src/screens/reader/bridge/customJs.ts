/**
 * Custom-JS bridge — builds the inline <script> body embedded into the
 * serialized chapter HTML that runs the user's custom JavaScript snippets.
 *
 * The wrapper (read chapter HTML → run custom snippets → write chapter HTML
 * back) is the injection surface user code always goes through. Two
 * properties are contract-tested:
 *   - the emitted body is parseable JavaScript (a bad wrapper would break a
 *     user's whole reader, silently);
 *   - user-authored text can never terminate the <script> tag early (an
 *     unescaped `</script` sequence would break the HTML page structure and
 *     open an injection hole) — `</script` is escaped to `<\/script`, which
 *     the HTML parser treats as text and the JS engine treats as `</script`
 *     inside string literals.
 *
 * CSS custom code is out of scope here; it is composed by
 * @utils/customCode and embedded as a style element by the component.
 */

/** Escape `</script` so an inline script cannot be terminated by its own body. */
const escapeScriptCloseTag = (code: string): string =>
  code.replace(/<\/(?=script)/gi, '<\\/');

/**
 * Build the inline custom-JS body for the chapter HTML. When no custom
 * JavaScript is configured the wrapper still emits — it is a no-op then —
 * so the contract (parses, runs, restores HTML) holds for every chapter.
 */
export const buildCustomJsInlineScript = (
  customJs: string,
): string => `function fn(){
  let html = document.querySelector('#LNReader-chapter').innerHTML;
  ${escapeScriptCloseTag(customJs)}
  document.querySelector('#LNReader-chapter').innerHTML = html;
}
document.addEventListener('DOMContentLoaded', fn);`;
