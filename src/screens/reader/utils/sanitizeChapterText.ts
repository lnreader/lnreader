import { getString } from '@strings/translations';
import sanitizeHtml from 'sanitize-html';

export const sanitizeChapterText = (
  pluginId: string,
  novelName: string,
  chapterName: string,
  html: string,
): string => {
  const text = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'html',
      'head',
      'body',
      'link',
      'style',
      'meta',
      'del',
      'ins',
      'img',
      'audio',
      'video',
      'source',
      'object',
      'svg',
      'math',
      'title',
      'details',
      'summary',
      'ref',
    ]),
    allowedAttributes: {
      '*': [
        'data-*',
        'class',
        'id',
        'lang',
        'dir',
        'title',
        'epub:type',
        'role',
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        'style',
      ],
      a: ['href', 'name', 'target'],
      img: ['src', 'srcset', 'alt', 'width', 'height', 'loading'],
      ol: ['reversed', 'start', 'type'],
      ul: ['type'],
      li: ['value'],
      p: ['align'],
      ref: ['href'],
      blockquote: ['cite'],
      table: ['border', 'cellpadding', 'cellspacing', 'width', 'summary'],
      td: ['colspan', 'rowspan', 'align', 'valign'],
      th: ['colspan', 'rowspan', 'align', 'valign', 'scope'],
      audio: ['src', 'controls'],
      video: ['src', 'controls', 'width', 'height'],
      source: ['src', 'type', 'srcset'],
      svg: ['width', 'height', 'viewBox', 'xmlns'],
      q: ['cite'],
      time: ['datetime'],
      del: ['cite', 'datetime'],
      ins: ['cite', 'datetime'],
      link: ['rel', 'type', 'href', 'media'],
      meta: ['charset', 'name', 'content', 'http-equiv'],
    },
    allowedSchemes: ['data', 'http', 'https', 'file'],
    transformTags: {
      '*': function (tagName, attribs) {
        if (attribs.style) {
          const isTranslated =
            attribs.class &&
            (attribs.class.includes('translated-text') ||
              attribs.class.includes('translated'));
          attribs.style = attribs.style
            .split(';')
            .map(style => style.trim())
            .filter(style => {
              if (!style) return false;
              const lower = style.toLowerCase();

              if (
                lower.startsWith('font-size') ||
                lower.startsWith('line-height') ||
                lower.startsWith('font-family')
              ) {
                return false;
              }

              if (!isTranslated) {
                if (
                  lower.startsWith('color') ||
                  lower.startsWith('background')
                ) {
                  return false;
                }
              }

              return true;
            })
            .join('; ');
        }
        return {
          tagName: tagName,
          attribs: attribs,
        };
      },
    },
  });

  return (
    text ||
    getString('readerScreen.emptyChapterMessage', {
      pluginId,
      novelName,
      chapterName,
    })
  );
};
