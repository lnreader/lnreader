import { load } from 'cheerio';

export function filterChapterText(html: string, filters: string[]): string {
  const strings = filters.filter(text => text.trim().length > 0);
  if (!html || strings.length === 0) return html;

  const $ = load(html, {}, false);
  const visit = (nodes: ReturnType<typeof $.root>['0']['children']) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        for (const text of strings) {
          node.data = node.data.split(text).join('');
        }
      } else if (
        'children' in node &&
        !['script', 'style'].includes(node.type)
      ) {
        visit(node.children);
      }
    }
  };
  visit($.root()[0].children);
  return $.html();
}
