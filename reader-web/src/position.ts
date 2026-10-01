import type { ReaderLocation } from '../../src/screens/reader/engine/protocol';
import { renderMarginals } from './marginals';
import { log, primaryDocument, type ReaderState } from './state';
import type { FoliatePaginator, RelocateDetail } from './types';

const FONT_WAIT_MS = 1500;

export const updateMarginals = (state: ReaderState) => {
  const { paginator, prefs, location } = state;
  if (!paginator || !prefs || !location) {
    return;
  }
  renderMarginals(paginator, state.status, prefs, {
    page: location.page,
    pages: location.pages,
    fraction: location.fraction,
    battery: state.battery,
  });
};

// The paginator skips the first scroll after a jump as the jump's own. If the
// jump didn't move, that skip eats the reader's next real scroll, so the
// position stops updating; a scroll event of our own takes the skip instead.
const followScrolling = (paginator: FoliatePaginator, start: number) => {
  if (!paginator.scrolled || paginator.containerPosition !== start) {
    return;
  }
  requestAnimationFrame(() =>
    paginator.shadowRoot
      ?.getElementById('container')
      ?.dispatchEvent(new Event('scroll')),
  );
};

const scrolledShare = (state: ReaderState, index: number) => {
  const paginator = state.paginator;
  const doc = paginator
    ?.getContents()
    .find(content => content.index === index)?.doc;
  const height = doc?.documentElement.scrollHeight ?? 0;
  return paginator && height > 0 ? Math.min(1, paginator.size / height) : 0;
};

export const anchorTo = async (
  state: ReaderState,
  paginator: FoliatePaginator,
  target: Range | Element | number,
) => {
  if (typeof target !== 'number') {
    state.sentTo = target;
  }
  const start = paginator.containerPosition;
  await paginator.scrollToAnchor(target);
  followScrolling(paginator, start);
};

export const goTo = async (state: ReaderState, location: ReaderLocation) => {
  const index = state.book?.indexOf(location.chapterId) ?? -1;
  const paginator = state.paginator;
  if (index === -1 || !paginator) {
    log(state, 'warn', `No chapter ${location.chapterId} to open`);
    return;
  }
  state.sentTo = location;
  const fraction = Math.min(1, Math.max(0, location.fraction || 0));
  // Scrolled positions are progress between the first and last screens
  // (see `onRelocate`); the paginator wants the top of the screen.
  const anchor = () =>
    paginator.scrolled
      ? fraction * Math.max(0, 1 - scrolledShare(state, index))
      : fraction;
  const start = paginator.containerPosition;
  await paginator.goTo({ index, anchor: anchor() });
  followScrolling(paginator, start);
  if (fraction > 0) {
    // Pages are counted before the chapter's fonts arrive; once they have,
    // the same fraction can be a different page.
    await Promise.race([
      primaryDocument(state)?.fonts.ready,
      new Promise(resolve => setTimeout(resolve, FONT_WAIT_MS)),
    ]);
    if (state.paginator === paginator) {
      await anchorTo(state, paginator, anchor());
    }
  }
};

export const turn = async (
  state: ReaderState,
  direction: 'next' | 'prev',
  distance?: number,
) => {
  const paginator = state.paginator;
  if (!paginator) {
    return;
  }
  state.sentTo = undefined;
  if (direction === 'next' ? paginator.atEnd : paginator.atStart) {
    state.bridge.send({ type: 'boundary', direction });
    return;
  }
  const by = paginator.scrolled && distance ? distance : undefined;
  await (direction === 'next' ? paginator.next(by) : paginator.prev(by));
};

export const onRelocate = (
  state: ReaderState,
  { index, fraction, size, range }: RelocateDetail,
) => {
  const paginator = state.paginator;
  const chapter = state.book?.chapters[index];
  if (state.holdRelocation || !paginator || !chapter) {
    return;
  }
  let endFraction: number;
  let position = fraction;
  let page: number | undefined;
  let pages: number | undefined;
  if (paginator.scrolled) {
    // `fraction` is the screen's top, so the last screen starts short of 1;
    // report progress between the first and last screens instead.
    const share = scrolledShare(state, index);
    const snap = (value: number) => (value > 0.999 ? 1 : value);
    endFraction = snap(Math.min(1, fraction + share));
    position = share < 1 ? snap(Math.min(1, fraction / (1 - share))) : 0;
  } else {
    // `size` is the share of the chapter one spread shows.
    const share = size && size > 0 ? size : 1;
    const columns = paginator.columnCount || 1;
    const textPages = Math.max(1, Math.round(columns / share));
    pages = Math.max(1, Math.ceil(textPages / columns));
    page = Math.min(pages, Math.round(fraction / share) + 1);
    endFraction = Math.min(1, fraction + share);
    // The paginator opens fraction f at column round(f × (columns − 1)); report
    // pages in those terms so reopening lands on the same page.
    position = pages > 1 ? (page - 1) / (pages - 1) : 0;
  }
  state.location = { index, fraction: position, range, page, pages };
  state.bridge.send({
    type: 'relocate',
    chapterId: chapter.id,
    fraction: position,
    endFraction,
    page,
    pages,
    atStart: paginator.atStart,
    atEnd: paginator.atEnd,
  });
  updateMarginals(state);
};
