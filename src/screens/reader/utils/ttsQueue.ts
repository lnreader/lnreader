import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

const INLINE_NODE_NAMES = new Set([
  '#text',
  'B',
  'I',
  'SPAN',
  'EM',
  'BR',
  'STRONG',
  'A',
  'MARK',
]);

const nodeName = (node: AnyNode) =>
  node.type === 'text'
    ? '#text'
    : 'name' in node
    ? node.name.toUpperCase()
    : '';

const isElement = (node: AnyNode): node is Element => node.type === 'tag';

const isReadable = (element: Element) => {
  const name = element.name.toUpperCase();
  if (name !== 'SPAN' && INLINE_NODE_NAMES.has(name)) return false;
  if (element.childNodes.length === 0) return false;
  return element.childNodes.every(child =>
    INLINE_NODE_NAMES.has(nodeName(child)),
  );
};

export const normalizeTtsText = (text: string) => {
  if (!text) return '';
  const normalized = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s*([.,!?;:])\s*/g, '$1 ')
    .trim();

  const dashOnlyText = normalized.replace(/\s/g, '');
  if (
    dashOnlyText.length >= 3 &&
    /^[\-‐‑‒–—―−⁓⸺⸻﹘﹣－]+$/u.test(dashOnlyText)
  ) {
    return '';
  }
  return normalized;
};

const collectReadableText = (
  $: CheerioAPI,
  element: Element,
  queue: string[],
) => {
  if (isReadable(element)) {
    const readable = $(element).clone();
    readable.find('br').replaceWith(' ');
    const text = normalizeTtsText(readable.text());
    if (text) queue.push(text);
    return;
  }
  element.childNodes.filter(isElement).forEach(child => {
    collectReadableText($, child, queue);
  });
};

/** Builds the same flat paragraph queue as the reader WebView without executing DOM scripts. */
export const buildTtsQueueFromHtml = (html: string): string[] => {
  const $ = load(`<div id="lnreader-tts-root">${html}</div>`, null, false);
  const root = $('#lnreader-tts-root').get(0);
  if (!root || !isElement(root)) return [];
  const queue: string[] = [];
  collectReadableText($, root, queue);
  return queue;
};
