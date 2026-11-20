import { progressToIndex } from './fastScrollMath';

/** The subset of LegendListRef the scrollbar drives. */
export interface ScrubbableList {
  getState(): { contentLength: number; scrollLength: number; scroll: number };
  scrollToOffset(params: { offset: number; animated?: boolean }): unknown;
  scrollToIndex(params: { index: number; animated?: boolean }): unknown;
}

export interface ScrubTarget {
  getList: () => ScrubbableList | null | undefined;
  itemCount: number;
  loadedCount: number;
  /** Asked to load items up to `index` when scrubbing past the loaded ones. */
  onRequestItems?: (index: number) => void;
  /** Where the list will report its offset once the scroll has landed. */
  onSettleTarget: (offset: number) => void;
  /** Give up waiting for the list to report the settled offset. */
  onSettleTimeout: () => void;
}

const SETTLE_TIMEOUT_MS = 1000;
const PENDING_SETTLE_TIMEOUT_MS = 3000;

/**
 * JS-side half of the fast scrollbar. The thumb moves on the UI thread; this
 * turns thumb progress into list scrolls.
 *
 * Progress maps to a pixel offset with the same formula the thumb uses to
 * follow the scroll position, so once a scrub lands, the scroll-derived thumb
 * position matches where the finger left it.
 *
 * Pan updates can outpace the JS thread while the list renders new rows, so
 * scrubs are coalesced to one per animation frame using only the newest value.
 */
export class ScrubController {
  private target: ScrubTarget;
  private pendingProgress = -1;
  private frame: number | null = null;
  private awaitingItems: number | null = null;
  private released = false;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(target: ScrubTarget) {
    this.target = target;
  }

  setTarget(target: ScrubTarget) {
    const loadedChanged = target.loadedCount !== this.target.loadedCount;
    this.target = target;
    if (loadedChanged && this.awaitingItems !== null) {
      // Let the list take in the new items before scrolling to one of them.
      requestAnimationFrame(this.resolveAwaitedItems);
    }
  }

  begin = () => {
    this.released = false;
    this.awaitingItems = null;
    this.clearSettleTimer();
  };

  schedule = (progress: number) => {
    this.pendingProgress = progress;
    if (this.frame === null) {
      this.frame = requestAnimationFrame(this.flush);
    }
  };

  release = (progress: number) => {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.pendingProgress = -1;
    this.released = true;
    const offset = progress >= 0 ? this.scrollTo(progress) : null;
    if (offset !== null) {
      this.settle(offset);
    } else if (this.awaitingItems !== null) {
      this.startSettleTimer(PENDING_SETTLE_TIMEOUT_MS);
    } else {
      this.target.onSettleTimeout();
    }
  };

  dispose() {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.clearSettleTimer();
  }

  private flush = () => {
    this.frame = null;
    const progress = this.pendingProgress;
    if (progress >= 0) {
      this.scrollTo(progress);
    }
  };

  /** Scrolls the list; returns the resulting offset, or null if waiting on items. */
  private scrollTo(progress: number): number | null {
    const list = this.target.getList();
    const { itemCount, loadedCount } = this.target;
    if (!list || itemCount <= 0 || loadedCount <= 0) {
      return null;
    }
    const index = progressToIndex(progress, itemCount);
    if (index >= loadedCount) {
      if (this.awaitingItems === null || index > this.awaitingItems) {
        this.target.onRequestItems?.(index);
      }
      this.awaitingItems = index;
      return null;
    }
    this.awaitingItems = null;
    const loadedProgress =
      loadedCount >= itemCount
        ? progress
        : (progress * itemCount) / loadedCount;
    if (loadedProgress <= 1) {
      const { contentLength, scrollLength } = list.getState();
      const offset = loadedProgress * Math.max(0, contentLength - scrollLength);
      list.scrollToOffset({ offset, animated: false });
    } else {
      list.scrollToIndex({ index, animated: false });
    }
    // Non-animated scrolls update the list's internal offset synchronously,
    // already clamped to the scrollable range.
    return list.getState().scroll;
  }

  private resolveAwaitedItems = () => {
    const index = this.awaitingItems;
    const list = this.target.getList();
    if (index === null || !list || index >= this.target.loadedCount) {
      return;
    }
    this.awaitingItems = null;
    list.scrollToIndex({ index, animated: false });
    if (this.released) {
      this.settle(list.getState().scroll);
    }
  };

  private settle(offset: number) {
    this.target.onSettleTarget(offset);
    this.startSettleTimer(SETTLE_TIMEOUT_MS);
  }

  private startSettleTimer(ms: number) {
    this.clearSettleTimer();
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.target.onSettleTimeout();
    }, ms);
  }

  private clearSettleTimer() {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }
}
