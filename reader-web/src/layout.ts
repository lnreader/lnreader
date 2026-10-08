import 'foliate-js/paginator.js';

import type { ReaderPreferences } from '../../src/screens/reader/engine/preferences';
import { buildReaderStyles } from '../../src/screens/reader/engine/styles';
import { stopAutoScroll } from './autoscroll';
import { SPREAD_FILL_CLASS, SPREAD_FILLED_CLASS } from './content';
import { onSectionLoad } from './sectionDocument';
import { followSearch } from './search';
import { anchorTo, goTo, onRelocate, updateMarginals } from './position';
import { currentLocation, type ReaderState } from './state';
import type { FoliatePaginator, RelocateDetail } from './types';

const MAX_LINE_WIDTH = 720;
const COLUMN_GAP = '6%';
const PAGE_MARGIN_TOP = 24;
const PAGE_MARGIN_BOTTOM = 24;

export const createPaginator = (state: ReaderState) => {
  stopAutoScroll(state);
  state.search.clear();
  state.speech.stop();
  state.paginator?.destroy();
  state.paginator?.remove();
  const paginator = document.createElement(
    'foliate-paginator',
  ) as FoliatePaginator;
  state.paginator = paginator;
  state.appliedStyles = '';
  state.root.append(paginator);
  applyLayout(state);
  paginator.addEventListener('relocate', event => {
    onRelocate(state, (event as CustomEvent<RelocateDetail>).detail);
    followSearch(state);
  });
  // Every render replaces the footers; fill them again.
  paginator.addEventListener('stabilized', () => updateMarginals(state));
  paginator.addEventListener('load', event =>
    onSectionLoad(
      state,
      (event as CustomEvent<{ doc: Document; index: number }>).detail,
    ),
  );
  if (state.book) {
    paginator.open(state.book);
  }
};

// The paginator reads the orientation through a container query, so rotating
// needs no attribute change (which would re-render and lose the position).
const setPortraitColumns = (paginator: FoliatePaginator, count: number) => {
  const root = paginator.shadowRoot;
  if (!root) {
    return;
  }
  let style = root.getElementById('ln-portrait-columns');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ln-portrait-columns';
    root.append(style);
  }
  style.textContent = `#top { --_max-column-count-portrait: ${count}; }`;
};

export const applyLayout = (state: ReaderState) => {
  const { paginator, prefs } = state;
  if (!paginator || !prefs) {
    return;
  }
  // Between pages and scrolling the layouts differ too much for the text on
  // screen to find its place again: keep the place in the chapter instead.
  const modeSwitch =
    paginator.hasAttribute('flow') &&
    paginator.getAttribute('flow') !== prefs.flow;
  const location = modeSwitch ? currentLocation(state) : undefined;
  // The re-render shows wherever the old place lands in the new layout
  // (often the next chapter); that is not a place the reader went to.
  state.holdRelocation = !!location;
  // `auto` lets the paginator choose 1 or 2 columns; `2` forces a spread.
  const spread = prefs.columns === 2;
  const available = window.innerWidth - prefs.padding * 2;
  const lineWidth = spread
    ? Math.min(MAX_LINE_WIDTH, Math.floor(available / 2))
    : MAX_LINE_WIDTH;
  setPortraitColumns(paginator, spread ? 2 : 1);
  const attributes: Record<string, string | null> = {
    flow: prefs.flow,
    gap: COLUMN_GAP,
    'margin-top': `${PAGE_MARGIN_TOP}px`,
    'margin-bottom': `${PAGE_MARGIN_BOTTOM}px`,
    'margin-left': `${prefs.padding}px`,
    'margin-right': `${prefs.padding}px`,
    'max-inline-size': `${Math.max(200, lineWidth)}px`,
    'max-column-count': prefs.columns === 1 ? '1' : '2',
    animated: prefs.animation === 'none' ? null : '',
    'turn-style':
      prefs.animation === 'slide' || prefs.animation === 'curl'
        ? prefs.animation
        : null,
    'no-continuous-scroll': prefs.continuousChapters ? null : '',
  };
  let changed = false;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) {
      if (paginator.hasAttribute(name)) {
        paginator.removeAttribute(name);
        changed = true;
      }
    } else if (paginator.getAttribute(name) !== value) {
      paginator.setAttribute(name, value);
      changed = true;
    }
  }
  const styles = buildReaderStyles(prefs, state.config?.assetsUri ?? '');
  const css = styles.before + styles.after;
  if (css !== state.appliedStyles) {
    state.appliedStyles = css;
    paginator.setStyles([styles.before, styles.after]);
    changed = true;
  }
  // Attribute and style changes re-render; keep the text that was on screen.
  const range = state.location?.range;
  if (location) {
    requestAnimationFrame(() => {
      state.holdRelocation = false;
      void goTo(state, location);
    });
  } else if (changed && range) {
    requestAnimationFrame(() => void anchorTo(state, paginator, range));
  }
};

export const applyBackground = (state: ReaderState) => {
  const color = state.prefs?.backgroundColor ?? '';
  document.documentElement.style.background = color;
  document.body.style.background = color;
  // The footer and the status line inherit the text colour.
  document.documentElement.style.color = state.prefs?.textColor ?? '';
};

export const setPreferences = (
  state: ReaderState,
  prefs: ReaderPreferences,
) => {
  const previous = state.prefs;
  state.prefs = prefs;
  applyBackground(state);
  const contentChanged =
    !!previous &&
    (previous.showChapterTitle !== prefs.showChapterTitle ||
      previous.bionicReading !== prefs.bionicReading);
  if (contentChanged && state.book) {
    // Chapter markup depends on these; rebuild it at the same position.
    state.book.invalidate();
    const location = currentLocation(state);
    createPaginator(state);
    if (location) {
      void goTo(state, location);
    }
    return;
  }
  applyLayout(state);
  updateMarginals(state);
};

// The paginator only re-anchors when its current chapter resizes, not when
// an earlier one does.
const returnAfterRespread = (state: ReaderState) => {
  if (state.respread) {
    return;
  }
  state.respread = requestAnimationFrame(() => {
    state.respread = 0;
    const paginator = state.paginator;
    const target = state.sentTo ?? state.location?.range;
    if (!paginator || !target) {
      return;
    }
    if ('chapterId' in target) {
      void goTo(state, target);
    } else {
      void anchorTo(state, paginator, target);
    }
  });
};

// With two columns the paginator lets a chapter of an odd column count end
// halfway through a spread; the next one then starts mid-spread and its
// fraction jumps land a spread short. A blank column keeps whole spreads.
export const keepWholeSpreads = (state: ReaderState, doc: Document) => {
  const fill = doc.querySelector(`.${SPREAD_FILL_CLASS}`);
  const view = doc.defaultView?.frameElement?.parentElement;
  if (!fill || !view) {
    return;
  }
  let toggled = false;
  const observer = new ResizeObserver(() => {
    const paginator = state.paginator;
    if (!view.isConnected || !paginator) {
      observer.disconnect();
      return;
    }
    const columns = paginator.columnCount ?? 1;
    const filled = fill.classList.contains(SPREAD_FILLED_CLASS);
    let wanted = false;
    if (!paginator.scrolled && columns > 1) {
      const count = Math.round(
        view.getBoundingClientRect().width / (paginator.size / columns),
      );
      // Showing the blank column evens an odd count; hiding it evens a
      // count it made odd.
      wanted = count % columns === 0 ? filled : !filled;
    }
    if (wanted !== filled) {
      fill.classList.toggle(SPREAD_FILLED_CLASS, wanted);
      toggled = true;
    } else if (toggled) {
      toggled = false;
      returnAfterRespread(state);
    }
  });
  observer.observe(view);
};
