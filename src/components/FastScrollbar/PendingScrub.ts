/** The subset of LegendListRef needed to resolve a pending scrub. */
export interface MeasurableList {
  getState(): { contentLength: number; scrollLength: number };
}

export interface PendingScrubTarget {
  getList: () => MeasurableList | null | undefined;
  itemCount: number;
  loadedCount: number;
  /** Asked to load items up to `index`. */
  onRequestItems?: (index: number) => void;
  /** Scroll to `offset` now that the awaited items are in the list. */
  onResolved: (offset: number) => void;
}

/**
 * Handles scrubbing past the end of a partially loaded list. Normal scrubbing
 * never touches JS: the gesture scrolls the native view from the UI thread.
 * Only when the thumb points at items that are not loaded yet does it ask for
 * them here, and once they arrive this works out where to scroll.
 */
export class PendingScrub {
  private target: PendingScrubTarget;
  private progress: number | null = null;
  private requestedIndex = -1;
  private frame: number | null = null;

  constructor(target: PendingScrubTarget) {
    this.target = target;
  }

  setTarget(target: PendingScrubTarget) {
    const loadedChanged = target.loadedCount !== this.target.loadedCount;
    this.target = target;
    if (loadedChanged && this.progress !== null && this.frame === null) {
      // Let the list lay out the new items before measuring it.
      this.frame = requestAnimationFrame(this.resolve);
    }
  }

  request = (progress: number, index: number) => {
    this.progress = progress;
    if (index > this.requestedIndex) {
      this.requestedIndex = index;
      this.target.onRequestItems?.(index);
    }
  };

  cancel = () => {
    this.progress = null;
    this.requestedIndex = -1;
  };

  dispose() {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private resolve = () => {
    this.frame = null;
    const { progress } = this;
    const list = this.target.getList();
    const { itemCount, loadedCount } = this.target;
    if (progress === null || !list || loadedCount <= 0) {
      return;
    }
    const loadedProgress =
      loadedCount >= itemCount
        ? progress
        : (progress * itemCount) / loadedCount;
    if (loadedProgress > 1) {
      return;
    }
    const { contentLength, scrollLength } = list.getState();
    this.cancel();
    this.target.onResolved(
      loadedProgress * Math.max(0, contentLength - scrollLength),
    );
  };
}
