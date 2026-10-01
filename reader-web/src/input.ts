import { NEXT_CHAPTER_URL, REFRESH_URL } from './content';
import { anchorTo, turn } from './position';
import { currentChapter, type ReaderState } from './state';

const TURN_ZONE = 0.3;
const INTERACTION_THROTTLE_MS = 5000;
const SELECTION_DEBOUNCE_MS = 350;
const CHAPTER_SWIPE_PX = 180;
const PULL_REFRESH_PX = 80;

export const interaction = (state: ReaderState) => {
  state.sentTo = undefined;
  const now = Date.now();
  if (now - state.lastInteraction > INTERACTION_THROTTLE_MS) {
    state.lastInteraction = now;
    state.bridge.send({ type: 'interaction' });
  }
};

export const tap = (state: ReaderState, x: number, y: number) => {
  const { paginator, prefs } = state;
  if (!paginator || !prefs) {
    return;
  }
  interaction(state);
  const rect = paginator.getBoundingClientRect();
  const rx = (x - rect.left) / (rect.width || 1);
  const ry = (y - rect.top) / (rect.height || 1);
  const rtl = state.config?.dir === 'rtl';
  if (!paginator.scrolled && prefs.tapToScroll) {
    if (rx < TURN_ZONE) {
      void turn(state, rtl ? 'next' : 'prev');
      return;
    }
    if (rx > 1 - TURN_ZONE) {
      void turn(state, rtl ? 'prev' : 'next');
      return;
    }
  }
  if (paginator.scrolled && prefs.tapToScroll) {
    if (ry < TURN_ZONE) {
      void turn(state, 'prev');
      return;
    }
    if (ry > 1 - TURN_ZONE) {
      void turn(state, 'next');
      return;
    }
  }
  state.bridge.send({ type: 'tap' });
};

const openLink = (
  state: ReaderState,
  link: HTMLAnchorElement,
  doc: Document,
) => {
  const href = link.getAttribute('href') ?? '';
  if (href === NEXT_CHAPTER_URL) {
    state.bridge.send({ type: 'navigate-chapter', direction: 'next' });
    return;
  }
  if (href === REFRESH_URL) {
    const index = state.paginator
      ?.getContents()
      .find(content => content.doc === doc)?.index;
    const chapter =
      index === undefined ? undefined : state.book?.chapters[index];
    if (chapter) {
      state.bridge.send({ type: 'refresh-section', chapterId: chapter.id });
    }
    return;
  }
  if (href.startsWith('#')) {
    const target = doc.getElementById(decodeURIComponent(href.slice(1)));
    if (target && state.paginator) {
      void anchorTo(state, state.paginator, target);
    }
    return;
  }
  state.bridge.send({ type: 'open-link', href: link.href });
};

export const onDocumentClick = (
  state: ReaderState,
  event: MouseEvent,
  doc: Document,
) => {
  if (event.defaultPrevented) {
    return;
  }
  const target = event.target as Element | null;
  const link = target?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (link) {
    event.preventDefault();
    openLink(state, link, doc);
    return;
  }
  const selection = doc.getSelection();
  if (selection && !selection.isCollapsed) {
    return;
  }
  const frame = doc.defaultView?.frameElement?.getBoundingClientRect();
  tap(
    state,
    (frame?.left ?? 0) + event.clientX,
    (frame?.top ?? 0) + event.clientY,
  );
};

// Hardware keyboards (and some e-readers' page buttons) send key events.
export const onKeyDown = (state: ReaderState, event: KeyboardEvent) => {
  const rtl = state.config?.dir === 'rtl';
  const forward = [
    'ArrowDown',
    'PageDown',
    ' ',
    rtl ? 'ArrowLeft' : 'ArrowRight',
  ];
  const backward = ['ArrowUp', 'PageUp', rtl ? 'ArrowRight' : 'ArrowLeft'];
  if (forward.includes(event.key)) {
    event.preventDefault();
    void turn(state, 'next');
  } else if (backward.includes(event.key)) {
    event.preventDefault();
    void turn(state, 'prev');
  }
};

export const onSelectionChange = (state: ReaderState, doc: Document) => {
  clearTimeout(state.selectionTimer);
  state.selectionTimer = setTimeout(() => {
    const text = doc.getSelection()?.toString().trim() ?? '';
    if (text) {
      state.hasSelection = true;
      state.bridge.send({ type: 'selection', text });
    } else if (state.hasSelection) {
      state.hasSelection = false;
      state.bridge.send({ type: 'selection-cleared' });
    }
  }, SELECTION_DEBOUNCE_MS);
};

export const listenForSwipes = (state: ReaderState, doc: Document) => {
  let start: { x: number; y: number } | undefined;
  doc.addEventListener(
    'touchstart',
    event => {
      const touch = event.changedTouches[0];
      start = touch && { x: touch.screenX, y: touch.screenY };
    },
    { passive: true },
  );
  doc.addEventListener(
    'touchend',
    event => {
      const touch = event.changedTouches[0];
      const paginator = state.paginator;
      const from = start;
      start = undefined;
      if (!touch || !from || !paginator?.scrolled) {
        return;
      }
      const dx = touch.screenX - from.x;
      const dy = touch.screenY - from.y;
      if (
        dy > PULL_REFRESH_PX &&
        Math.abs(dy) > Math.abs(dx) * 2 &&
        paginator.containerPosition <= 0
      ) {
        const chapter = currentChapter(state);
        if (chapter) {
          state.bridge.send({ type: 'refresh-section', chapterId: chapter.id });
        }
        return;
      }
      if (
        state.prefs?.swipeGestures &&
        Math.abs(dx) > CHAPTER_SWIPE_PX &&
        Math.abs(dx) > Math.abs(dy) * 2
      ) {
        const middle = window.screen.width / 2;
        if (dx < 0 && from.x >= middle) {
          state.bridge.send({ type: 'navigate-chapter', direction: 'next' });
        } else if (dx > 0 && from.x <= middle) {
          state.bridge.send({ type: 'navigate-chapter', direction: 'prev' });
        }
      }
    },
    { passive: true },
  );
};
