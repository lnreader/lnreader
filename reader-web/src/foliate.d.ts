declare module 'foliate-js/paginator.js' {
  export const fontsReady: (doc: Document) => Promise<unknown>;
}

declare module 'foliate-js/text-walker.js' {
  export const textWalker: (
    x: Range | Document,
    func: (
      strs: string[],
      makeRange: (a: number, b: number, c: number, d: number) => Range,
    ) => Iterable<unknown>,
    filter?: (node: Node) => number,
  ) => Iterable<unknown>;
}

declare module 'foliate-js/search.js' {
  export const searchMatcher: (
    textWalker: unknown,
    opts: {
      query: string;
      matchCase?: boolean;
      matchDiacritics?: boolean;
      matchWholeWords?: boolean;
      defaultLocale?: unknown;
    },
  ) => (doc: Document, query: string) => Iterable<{ range: Range }>;
}

declare module 'foliate-js/tts.js' {
  export function getSentences(
    doc: Document,
    textWalker: unknown,
    nodeFilter?: (node: Node) => number,
    granularity?: 'sentence' | 'word',
  ): Iterable<{ blockIndex: number; markName: string; range: Range }>;
}
