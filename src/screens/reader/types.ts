export type ReaderSearchResult = {
  query: string;
  current: number;
  total: number;
  renderedTotal: number;
  isTruncated: boolean;
};

export const EMPTY_READER_SEARCH_RESULT: ReaderSearchResult = {
  query: '',
  current: 0,
  total: 0,
  renderedTotal: 0,
  isTruncated: false,
};
