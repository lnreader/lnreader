export interface ChapterContent {
  html: string;
  baseUrl?: string;
}

export interface DocumentOptions {
  title: string;
  showTitle: boolean;
  bionic: boolean;
  ending?: { finished: string; next?: string; noNext: string };
  dir: 'ltr' | 'rtl';
  lang?: string;
  // Lets custom CSS target one source.
  sourceId?: string;
}

// Custom code has always addressed the chapter by this id.
export const CHAPTER_ELEMENT_ID = 'LNReader-chapter';

export const REFRESH_URL = 'lnreader://refresh-chapter';
export const NEXT_CHAPTER_URL = 'lnreader://next-chapter';
export const SPREAD_FILL_CLASS = 'ln-spread-fill';
export const SPREAD_FILLED_CLASS = 'ln-filled';

// Letters and digits only, so "Chapter 1 - Name" matches "Chapter 1: Name".
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const SKIPPED = new Set(['SCRIPT', 'STYLE', 'PRE', 'CODE', 'KBD', 'SAMP']);

const TITLE_BLOCKS = 'h1, h2, h3, h4, h5, h6, p, div, strong, b, span';

const startsWithTitle = (body: HTMLElement, title: string) => {
  const wanted = normalize(title);
  if (!wanted) {
    return true;
  }
  // The block around the first text: a wrapper's text is the whole chapter.
  const walker = body.ownerDocument.createTreeWalker(
    body,
    NodeFilter.SHOW_TEXT,
  );
  let first = walker.nextNode();
  while (
    first &&
    (!normalize(first.nodeValue ?? '') ||
      SKIPPED.has(first.parentElement?.tagName ?? ''))
  ) {
    first = walker.nextNode();
  }
  const element = first?.parentElement?.closest(TITLE_BLOCKS);
  if (!element || !body.contains(element)) {
    return false;
  }
  const text = normalize(element.textContent ?? '');
  const heading = /^H[1-6]$/.test(element.tagName);
  // A long paragraph that merely starts with the same words is body text,
  // not a title.
  return (
    text === wanted ||
    (heading && text.includes(wanted)) ||
    (text.startsWith(wanted) && text.length <= wanted.length + 12)
  );
};

const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;

export const applyBionic = (root: HTMLElement) => {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => {
      for (
        let el = node.parentElement;
        el && el !== root;
        el = el.parentElement
      ) {
        if (SKIPPED.has(el.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
      }
      return node.nodeValue?.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
  }
  for (const node of nodes) {
    const text = node.nodeValue ?? '';
    const fragment = doc.createDocumentFragment();
    let last = 0;
    for (const match of text.matchAll(WORD)) {
      const start = match.index ?? 0;
      const word = match[0];
      const cut = word.length <= 3 ? 1 : Math.ceil(word.length / 2);
      fragment.append(text.slice(last, start));
      const bold = doc.createElement('b');
      bold.className = 'ln-bionic';
      bold.textContent = word.slice(0, cut);
      fragment.append(bold, word.slice(cut));
      last = start + word.length;
    }
    if (last > 0) {
      fragment.append(text.slice(last));
      node.replaceWith(fragment);
    }
  }
};

// Nothing that runs code or embeds a document, and no chapter stylesheets:
// the reader themes apply to every chapter, scraped or imported.
const REMOVED_ELEMENTS =
  'script, noscript, iframe, frame, frameset, object, embed, applet, portal, ' +
  'base, meta[http-equiv], link, style';

const PRESENTATIONAL_ATTRIBUTES = new Set([
  'bgcolor',
  'background',
  'color',
  'face',
  'text',
  'link',
  'vlink',
  'alink',
]);

const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'xlink:href',
  'action',
  'formaction',
  'data',
  'poster',
]);

const SCRIPT_URL = /^\s*(javascript|vbscript|data:text\/html)/i;

// Backstop in case something slips through; plugin scripts run from the
// reader page, not the chapter.
const CONTENT_SECURITY_POLICY =
  "script-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'";

// No chapter code runs and none of its styling survives.
export const stripChapter = (doc: Document) => {
  doc.querySelectorAll(REMOVED_ELEMENTS).forEach(node => node.remove());
  for (const element of doc.querySelectorAll('*')) {
    for (const { name, value } of [...element.attributes]) {
      const lower = name.toLowerCase();
      if (
        lower.startsWith('on') ||
        lower === 'style' ||
        PRESENTATIONAL_ATTRIBUTES.has(lower) ||
        (URL_ATTRIBUTES.has(lower) && SCRIPT_URL.test(value))
      ) {
        element.removeAttribute(name);
      }
    }
  }
};

export const buildChapterDocument = (
  content: ChapterContent,
  options: DocumentOptions,
): string => {
  const doc = new DOMParser().parseFromString(content.html, 'text/html');
  stripChapter(doc);

  const root = doc.documentElement;
  if (!root.getAttribute('dir')) {
    root.setAttribute('dir', options.dir);
  }
  if (options.lang && !root.getAttribute('lang')) {
    root.setAttribute('lang', options.lang);
  }

  const head = doc.head;
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const policy = doc.createElement('meta');
  policy.setAttribute('http-equiv', 'Content-Security-Policy');
  policy.setAttribute('content', CONTENT_SECURITY_POLICY);
  head.prepend(charset, policy);
  if (content.baseUrl) {
    // Ahead of the policy: once a policy is in force, a later base is ignored.
    const base = doc.createElement('base');
    base.setAttribute('href', content.baseUrl);
    head.prepend(base);
  }
  if (!doc.title) {
    doc.title = options.title;
  }

  const body = doc.body;
  if (options.sourceId) {
    body.id = `sourceId-${options.sourceId}`;
  }
  const chapter = doc.createElement('div');
  chapter.id = CHAPTER_ELEMENT_ID;
  chapter.append(...body.childNodes);
  body.append(chapter);
  if (options.showTitle && !startsWithTitle(chapter, options.title)) {
    const heading = doc.createElement('h1');
    heading.className = 'ln-chapter-title';
    heading.textContent = options.title;
    chapter.prepend(heading);
  }
  if (options.bionic) {
    applyBionic(chapter);
  }
  if (options.ending) {
    body.append(chapterEnding(doc, options.ending));
  }
  const fill = doc.createElement('div');
  fill.className = SPREAD_FILL_CLASS;
  body.append(fill);
  return `<!DOCTYPE html>\n${root.outerHTML}`;
};

const chapterEnding = (
  doc: Document,
  ending: NonNullable<DocumentOptions['ending']>,
) => {
  const element = doc.createElement('div');
  element.className = 'ln-chapter-end';
  const finished = doc.createElement('p');
  finished.textContent = ending.finished;
  element.append(finished);
  if (ending.next) {
    const next = doc.createElement('a');
    next.className = 'ln-next-chapter';
    next.href = NEXT_CHAPTER_URL;
    next.textContent = ending.next;
    element.append(next);
  } else {
    const none = doc.createElement('p');
    none.textContent = ending.noNext;
    element.append(none);
  }
  return element;
};

export const buildErrorDocument = (
  title: string,
  message: string,
  retryLabel: string,
): string => {
  const doc = document.implementation.createHTMLDocument(title);
  const heading = doc.createElement('h1');
  heading.className = 'ln-chapter-title';
  heading.textContent = title;
  const text = doc.createElement('p');
  text.textContent = message;
  const retry = doc.createElement('p');
  const link = doc.createElement('a');
  link.href = REFRESH_URL;
  link.textContent = retryLabel;
  retry.append(link);
  doc.body.append(heading, text, retry);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
};
