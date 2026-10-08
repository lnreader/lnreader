import { searchMatcher } from 'foliate-js/search.js';
import { textWalker } from 'foliate-js/text-walker.js';

import { HIGHLIGHTS } from '../../src/screens/reader/engine/styles';
import { endsAfter, inReaderUi, setHighlight } from './highlights';
import { anchorTo } from './position';
import { primaryDocument, type ReaderState } from './state';

/** Keeps highlighting responsive on chapters full of a common word. */
const MAX_MATCHES = 2000;

export interface SearchState {
  query: string;
  /** 1-based; 0 when nothing matched. */
  current: number;
  total: number;
}

export const createSearch = () => {
  let query = '';
  let doc: Document | undefined;
  let ranges: Range[] = [];
  let current = -1;

  const state = (): SearchState => ({
    query,
    current: current + 1,
    total: ranges.length,
  });

  const select = (index: number) => {
    current = index;
    const range = ranges[index];
    if (doc && range) {
      setHighlight(doc, HIGHLIGHTS.searchCurrent, [range]);
    }
  };

  const clear = () => {
    if (doc) {
      setHighlight(doc, HIGHLIGHTS.search, []);
      setHighlight(doc, HIGHLIGHTS.searchCurrent, []);
    }
    doc = undefined;
    ranges = [];
    current = -1;
    query = '';
  };

  return {
    clear,
    query: () => query,
    document: () => doc,
    currentRange: (): Range | undefined => ranges[current],
    run: (target: Document, text: string, from?: Range): SearchState => {
      clear();
      query = text;
      const trimmed = text.trim();
      if (!trimmed) {
        return state();
      }
      doc = target;
      const matcher = searchMatcher(textWalker, {
        query: trimmed,
        matchCase: false,
        matchDiacritics: false,
        matchWholeWords: false,
      });
      for (const match of matcher(target, trimmed)) {
        if (inReaderUi(match.range)) {
          continue;
        }
        ranges.push(match.range);
        if (ranges.length >= MAX_MATCHES) {
          break;
        }
      }
      setHighlight(target, HIGHLIGHTS.search, ranges);
      if (ranges.length) {
        const next = ranges.findIndex(range => endsAfter(range, from));
        select(next === -1 ? 0 : next);
      }
      return state();
    },
    step: (direction: 1 | -1): SearchState => {
      if (ranges.length) {
        select((current + direction + ranges.length) % ranges.length);
      }
      return state();
    },
  };
};

export const showSearch = (state: ReaderState, result: SearchState) => {
  const range = state.search.currentRange();
  if (range && state.paginator) {
    void anchorTo(state, state.paginator, range);
  }
  state.bridge.send({ type: 'search-result', ...result });
};

/**
 * Matches belong to one chapter's document: once another chapter is the one on
 * screen, search that one instead, without moving the page.
 */
export const followSearch = (state: ReaderState) => {
  const query = state.search.query();
  const doc = primaryDocument(state);
  if (!query.trim() || !doc || doc === state.search.document()) {
    return;
  }
  const result = state.search.run(doc, query, state.location?.range);
  state.bridge.send({ type: 'search-result', ...result });
};

export const runSearch = (state: ReaderState, query: string) => {
  const doc = primaryDocument(state);
  if (doc) {
    showSearch(state, state.search.run(doc, query, state.location?.range));
  }
};
