import { CHAPTER_ELEMENT_ID } from './content';

interface ScriptContext {
  novelName: string;
  chapterName: string;
  sourceId: string;
  chapterId: number;
  novelId: number;
}

export type UserSnippets = (doc: Document, context: ScriptContext) => void;

// Same wrapper as the old reader page: snippets edit `html`, which is written
// back to the chapter, and run on the live document once it has loaded.
export const compileSnippets = (
  code: string,
  log: (message: string) => void,
): UserSnippets | undefined => {
  if (!code.trim()) {
    return undefined;
  }
  const chapter = `document.querySelector('#${CHAPTER_ELEMENT_ID}')`;
  let run: (...args: unknown[]) => unknown;
  try {
    run = new Function(
      'document',
      'window',
      'qs',
      'novelName',
      'chapterName',
      'sourceId',
      'chapterId',
      'novelId',
      `let html = ${chapter}.innerHTML;\n${code}\n${chapter}.innerHTML = html;`,
    ) as (...args: unknown[]) => unknown;
  } catch (error) {
    log(`Custom JS does not compile: ${String(error)}`);
    return undefined;
  }
  return (doc, context) => {
    if (!doc.getElementById(CHAPTER_ELEMENT_ID)) {
      return;
    }
    try {
      run(
        doc,
        doc.defaultView,
        (selector: string) => doc.querySelector(selector),
        context.novelName,
        context.chapterName,
        context.sourceId,
        context.chapterId,
        context.novelId,
      );
    } catch (error) {
      log(`Custom JS failed: ${String(error)}`);
    }
  };
};

// Run from the reader page: chapter documents forbid scripts.
export const runPluginScript = (
  code: string,
  doc: Document,
  log: (message: string) => void,
) => {
  if (!code.trim()) {
    return;
  }
  try {
    new Function('document', 'window', code)(doc, doc.defaultView);
  } catch (error) {
    log(`Plugin script failed: ${String(error)}`);
  }
};
