import * as cheerio from 'cheerio';
import NativeFile from '@specs/NativeFile';
import { NOVEL_STORAGE } from '@utils/Storages';
import type { ProviderId } from '@services/translate/types';
import { GtxProvider } from '@services/translate/providers/gtxProvider';
import { GoogleProvider } from '@services/translate/providers/googleProvider';
import { DeepLProvider } from '@services/translate/providers/deeplProvider';
import { MicrosoftProvider } from '@services/translate/providers/microsoftProvider';

export interface TranslateProviderConfig {
  providerId: ProviderId;
  apiKey?: string;
  extra?: Record<string, string>;
}

const PROVIDERS = {
  gtx: GtxProvider,
  google: GoogleProvider,
  deepl: DeepLProvider,
  microsoft: MicrosoftProvider,
};

const CACHE_DIR = `${NOVEL_STORAGE}/translation_cache`;
const SEPARATOR = '\n\n||||\n\n';
const MAX_CHUNK_LIMIT = 4000;

export const getTranslationCachePath = (
  chapterId: number,
  targetLang: string,
  mode: string,
  color: string,
  italic: boolean,
  underline: boolean,
): string => {
  const cleanColor = color.replace('#', '');
  return `${CACHE_DIR}/${chapterId}_${targetLang}_${mode}_${cleanColor}_${italic}_${underline}.html`;
};

export const getCachedTranslation = (
  chapterId: number,
  targetLang: string,
  mode: string,
  color: string,
  italic: boolean,
  underline: boolean,
): string | null => {
  try {
    const path = getTranslationCachePath(
      chapterId,
      targetLang,
      mode,
      color,
      italic,
      underline,
    );
    if (NativeFile.exists(path)) {
      return NativeFile.readFile(path);
    }
  } catch {}
  return null;
};

export const saveTranslationToCache = (
  chapterId: number,
  targetLang: string,
  mode: string,
  color: string,
  italic: boolean,
  underline: boolean,
  html: string,
): void => {
  try {
    if (!NativeFile.exists(CACHE_DIR)) {
      NativeFile.mkdir(CACHE_DIR);
    }
    const path = getTranslationCachePath(
      chapterId,
      targetLang,
      mode,
      color,
      italic,
      underline,
    );
    NativeFile.writeFile(path, html);
  } catch {}
};

export const clearTranslationCache = (): void => {
  try {
    if (NativeFile.exists(CACHE_DIR)) {
      NativeFile.unlink(CACHE_DIR);
    }
  } catch {}
};

export const clearNovelTranslationCache = (chapters: any[]): void => {
  try {
    if (!NativeFile.exists(CACHE_DIR)) {
      return;
    }
    const files = NativeFile.readDir(CACHE_DIR);

    // Create a set of chapter IDs for O(1) lookup
    const chapterIdSet = new Set(chapters.map(c => c.id.toString()));

    for (const file of files) {
      // Filename format: chapterId_targetLang_mode_color_italic_underline.html
      const parts = file.name.split('_');
      if (parts.length > 0) {
        const chapterIdStr = parts[0];
        if (chapterIdSet.has(chapterIdStr)) {
          NativeFile.unlink(file.path);
        }
      }
    }
  } catch {}
};

const textMemoryCache = new Map<
  string,
  { translated: string; detectedLang: string }
>();

const translateText = async (
  text: string,
  targetLang: string,
): Promise<{ translated: string; detectedLang: string }> => {
  const cacheKey = `${targetLang}:${text}`;
  const shouldCache = text.length <= 500;
  if (shouldCache && textMemoryCache.has(cacheKey)) {
    return textMemoryCache.get(cacheKey)!;
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(
    text,
  )}`;

  const response = await fetch(url, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`Translation service returned status: ${response.status}`);
  }
  const data = await response.json();
  const sentences = data[0];
  const detectedLang = data[2] || '';
  if (!sentences) return { translated: '', detectedLang };

  let translated = '';
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i] && sentences[i][0]) {
      translated += sentences[i][0];
    }
  }

  if (shouldCache) {
    textMemoryCache.set(cacheKey, { translated, detectedLang });
    // Keep cache size manageable
    if (textMemoryCache.size > 2000) {
      const keys = Array.from(textMemoryCache.keys());
      for (let i = 0; i < 500; i++) {
        textMemoryCache.delete(keys[i]);
      }
    }
  }

  return { translated, detectedLang };
};

const splitTranslatedResponse = (
  result: string,
  expectedCount: number,
): string[] | null => {
  const delimiters = [SEPARATOR, '\n\n||||\n\n', '\n||||\n', '||||'];
  for (const delim of delimiters) {
    const parts = result.split(delim);
    if (parts.length === expectedCount) {
      return parts;
    }
  }

  const partsRegex = result.split(/\s*\|\|\|\|\s*/);
  if (partsRegex.length === expectedCount) {
    return partsRegex;
  }

  return null;
};

interface TranslationItem {
  el: any;
  text: string;
}

const hasDirectText = (el: any): boolean => {
  const children = el.children || el.childNodes;
  if (!children) return false;
  for (const child of children) {
    if (child.type === 'text' || child.nodeType === 3) {
      const text = child.data || child.nodeValue || '';
      if (text.trim().length > 0) {
        return true;
      }
    }
  }
  return false;
};

export const translateHtml = async (
  html: string,
  targetLang: string,
  mode: 'translated' | 'dual',
  styles: { color: string; italic: boolean; underline: boolean },
  providerConfig?: TranslateProviderConfig,
): Promise<string> => {
  const providerId = providerConfig?.providerId ?? 'gtx';
  const useProviderBatch = providerId !== 'gtx';

  if (!html || !targetLang) {
    return html;
  }

  if (
    html.includes('class="translated-text"') ||
    html.includes('class=\\"translated-text\\"')
  ) {
    return html;
  }

  const $ = cheerio.load(html);

  const elements = $(
    'p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, div, span, section, article',
  ).toArray();

  const candidates: any[] = [];

  for (const el of elements) {
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';
    let isCandidate = false;
    if (
      [
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'li',
        'blockquote',
        'td',
        'th',
      ].includes(tagName)
    ) {
      isCandidate = true;
    } else if (['div', 'span', 'section', 'article'].includes(tagName)) {
      isCandidate = hasDirectText(el);
    }
    if (isCandidate) {
      const text = $(el).text().trim();
      if (text.length > 0) {
        candidates.push(el);
      }
    }
  }

  const candidateSet = new Set(candidates);
  const topCandidates: any[] = [];
  for (const el of candidates) {
    let parent = el.parent;
    let hasCandidateAncestor = false;
    while (parent) {
      if (candidateSet.has(parent)) {
        hasCandidateAncestor = true;
        break;
      }
      parent = parent.parent;
    }
    if (!hasCandidateAncestor) {
      topCandidates.push(el);
    }
  }

  const items: TranslationItem[] = [];
  for (const el of topCandidates) {
    items.push({ el, text: $(el).text().trim() });
  }

  // Fallback: if no structured elements found, extract text from body and create paragraphs
  if (items.length === 0) {
    const bodyText = $('body').text().trim();

    if (bodyText.length === 0) {
      return html;
    }

    // Split body text into paragraphs by newlines
    const paragraphs = bodyText
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (paragraphs.length === 0) {
      return html;
    }

    // Translate paragraphs directly
    const translatedParagraphs: { idx: number; html: string }[] = [];
    const rtlLangsSet = new Set(['ar', 'he', 'fa', 'ur']);
    const isTargetRtl = rtlLangsSet.has(targetLang);
    const dirAttr = isTargetRtl ? ' dir="rtl"' : '';
    const inlineStyle = `color: ${styles.color};${
      styles.italic ? ' font-style: italic;' : ''
    }${styles.underline ? ' text-decoration: underline;' : ''}`;

    // --- Provider-based batch for fallback paragraphs ---
    if (useProviderBatch) {
      const provider = PROVIDERS[providerId];
      try {
        const translated = await provider.translateBatch(
          paragraphs,
          targetLang,
          providerConfig?.apiKey,
          providerConfig?.extra,
        );
        for (let i = 0; i < paragraphs.length; i++) {
          const original = paragraphs[i];
          const trans = translated[i]?.trim() || '';
          if (mode === 'translated') {
            translatedParagraphs.push({
              idx: i,
              html: `<p${dirAttr}>${trans || original}</p>`,
            });
          } else {
            translatedParagraphs.push({
              idx: i * 2,
              html: `<p>${original}</p>`,
            });
            if (trans) {
              translatedParagraphs.push({
                idx: i * 2 + 1,
                html: `<p class="translated-text" style="${inlineStyle}"${dirAttr}>${trans}</p>`,
              });
            }
          }
        }
      } catch {
        for (let i = 0; i < paragraphs.length; i++) {
          translatedParagraphs.push({
            idx: i,
            html: `<p>${paragraphs[i]}</p>`,
          });
        }
      }
      translatedParagraphs.sort((a, b) => a.idx - b.idx);
      return translatedParagraphs.map(p => p.html).join('\n');
    }

    // Group paragraphs into chunks by character limit
    const paraChunks: { startIdx: number; batch: string[] }[] = [];
    let currentBatch: string[] = [];
    let currentLen = 0;
    let startIdx = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const pLen = paragraphs[i].length + SEPARATOR.length;
      if (currentLen + pLen > MAX_CHUNK_LIMIT && currentBatch.length > 0) {
        paraChunks.push({ startIdx, batch: currentBatch });
        startIdx = i;
        currentBatch = [];
        currentLen = 0;
      }
      currentBatch.push(paragraphs[i]);
      currentLen += pLen;
    }
    if (currentBatch.length > 0) {
      paraChunks.push({ startIdx, batch: currentBatch });
    }

    for (let i = 0; i < paraChunks.length; i++) {
      const chunk = paraChunks[i];
      const { startIdx: sIdx, batch } = chunk;
      const combined = batch.join(SEPARATOR);

      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const { translated, detectedLang } = await translateText(
          combined,
          targetLang,
        );

        if (
          detectedLang &&
          detectedLang.split('-')[0] === targetLang.split('-')[0]
        ) {
          return html; // Same language detected, abort translation and return original text
        }

        const parts = translated.split(/\s*\|\|\|\|\s*/);

        for (let j = 0; j < batch.length; j++) {
          const original = batch[j];
          const trans = parts[j]?.trim() || '';

          if (mode === 'translated') {
            translatedParagraphs.push({
              idx: sIdx + j,
              html: `<p${dirAttr}>${trans || original}</p>`,
            });
          } else {
            translatedParagraphs.push({
              idx: (sIdx + j) * 2,
              html: `<p>${original}</p>`,
            });
            if (trans) {
              translatedParagraphs.push({
                idx: (sIdx + j) * 2 + 1,
                html: `<p class="translated-text" style="${inlineStyle}"${dirAttr}>${trans}</p>`,
              });
            }
          }
        }
      } catch {
        for (let j = 0; j < batch.length; j++) {
          translatedParagraphs.push({
            idx: (sIdx + j) * 2,
            html: `<p>${batch[j]}</p>`,
          });
        }
      }
    }

    // Sort by index to maintain order
    translatedParagraphs.sort((a, b) => a.idx - b.idx);

    return translatedParagraphs.map(p => p.html).join('\n');
  }

  // --- Provider-based batch translation (non-GTX) ---
  if (useProviderBatch) {
    const provider = PROVIDERS[providerId];
    const allTexts = items.map(item => item.text);

    try {
      const translated = await provider.translateBatch(
        allTexts,
        targetLang,
        providerConfig?.apiKey,
        providerConfig?.extra,
      );

      for (let i = 0; i < items.length; i++) {
        const translatedText = translated[i]?.trim() || '';
        if (translatedText) {
          applyTranslation(
            $,
            items[i].el,
            translatedText,
            mode,
            styles,
            targetLang,
          );
        }
      }
    } catch {
      // On failure, return original HTML rather than crashing
    }

    return $.html();
  }

  // --- GTX chunk-by-chunk translation (default) ---
  const chunks: TranslationItem[][] = [];
  let currentChunk: TranslationItem[] = [];
  let currentLength = 0;

  for (const item of items) {
    const itemLen = item.text.length + SEPARATOR.length;
    if (currentLength + itemLen > MAX_CHUNK_LIMIT && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(item);
    currentLength += itemLen;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Process chunks sequentially to prevent HTTP 429 Rate Limiting from Google API
  for (const chunk of chunks) {
    const combinedText = chunk.map(item => item.text).join(SEPARATOR);
    let translatedCombined = '';
    let success = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { translated, detectedLang } = await translateText(
          combinedText,
          targetLang,
        );

        if (
          detectedLang &&
          detectedLang.split('-')[0] === targetLang.split('-')[0]
        ) {
          return html; // Same language detected, abort translation and return original HTML
        }

        translatedCombined = translated;
        if (translatedCombined.trim().length > 0) {
          success = true;
          break;
        }
      } catch {
        if (attempt < 2) {
          await new Promise(resolve =>
            setTimeout(resolve, (attempt + 1) * 1500),
          );
        }
      }
    }

    let parts: string[] | null = null;
    if (success) {
      parts = splitTranslatedResponse(translatedCombined, chunk.length);
    }

    if (parts && parts.length === chunk.length) {
      for (let i = 0; i < chunk.length; i++) {
        const item = chunk[i];
        const translationText = parts[i].trim();
        applyTranslation($, item.el, translationText, mode, styles, targetLang);
      }
    } else {
      for (const item of chunk) {
        try {
          const { translated, detectedLang } = await translateText(
            item.text,
            targetLang,
          );

          if (
            detectedLang &&
            detectedLang.split('-')[0] === targetLang.split('-')[0]
          ) {
            return html;
          }

          applyTranslation(
            $,
            item.el,
            translated.trim(),
            mode,
            styles,
            targetLang,
          );
        } catch {}
      }
    }
  }

  return $.html();
};

const rtlLangs = new Set(['ar', 'he', 'fa', 'ur']);

const applyTranslation = (
  $: any,
  el: any,
  translatedText: string,
  mode: 'translated' | 'dual',
  styles: { color: string; italic: boolean; underline: boolean },
  targetLang: string,
): void => {
  if (!translatedText) return;

  const inlineStyle = `color: ${styles.color};${
    styles.italic ? ' font-style: italic;' : ''
  }${styles.underline ? ' text-decoration: underline;' : ''}`;
  const isRtl = rtlLangs.has(targetLang);
  const dirAttribute = isRtl ? ' dir="rtl"' : '';

  if (mode === 'translated') {
    $(el).text(translatedText);
    if (isRtl) {
      $(el).attr('dir', 'rtl');
    } else {
      if ($(el).attr('dir') === 'rtl') {
        $(el).removeAttr('dir');
      }
    }
  } else {
    const tagName = el.tagName ? el.tagName.toLowerCase() : 'p';
    let wrapperTag = 'p';
    let extraStyle = '';
    if (tagName.startsWith('h')) {
      wrapperTag = tagName === 'h1' ? 'h2' : tagName;
      extraStyle = ' font-size: 1.1em; margin-top: 4px;';
    } else if (tagName === 'span') {
      wrapperTag = 'span';
      extraStyle = ' display: block; margin-top: 2px;';
    } else if (tagName === 'li') {
      wrapperTag = 'li';
      extraStyle = ' list-style-type: none;';
    } else if (
      tagName === 'div' ||
      tagName === 'section' ||
      tagName === 'article'
    ) {
      wrapperTag = 'div';
      extraStyle = ' margin-top: 4px;';
    }

    const translatedHtml = `<${wrapperTag} class="translated-text" style="${inlineStyle}${extraStyle}"${dirAttribute}>${translatedText}</${wrapperTag}>`;
    $(el).after(translatedHtml);
  }
};
