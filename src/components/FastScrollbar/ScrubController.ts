import * as Haptics from 'expo-haptics';

export interface ScrubHandlers {
  onScrub: (index: number) => void;
  onScrubEnd?: (index: number) => void;
  getLabel?: (index: number) => string | undefined;
  setLabel?: (text: string | undefined) => void;
  hapticFeedback?: boolean;
}

/**
 * JS-side half of the fast scrollbar. The thumb itself moves on the UI thread;
 * this receives index changes from the gesture and forwards them to the list.
 *
 * Pan updates can outpace the JS thread while the list renders new rows, so
 * scrubs are coalesced to one per animation frame using only the newest index.
 */
export class ScrubController {
  private handlers: ScrubHandlers;
  private pendingIndex = -1;
  private frame: number | null = null;

  constructor(handlers: ScrubHandlers) {
    this.handlers = handlers;
  }

  setHandlers(handlers: ScrubHandlers) {
    this.handlers = handlers;
  }

  grab = (index: number) => {
    if (this.handlers.hapticFeedback) {
      Haptics.selectionAsync();
    }
    if (index >= 0) {
      this.updateLabel(index);
    }
  };

  schedule = (index: number) => {
    this.pendingIndex = index;
    if (this.frame === null) {
      this.frame = requestAnimationFrame(this.flush);
    }
  };

  release = (index: number) => {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.flush();
    }
    this.pendingIndex = -1;
    if (index >= 0) {
      this.handlers.onScrubEnd?.(index);
    }
  };

  dispose() {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private flush = () => {
    this.frame = null;
    const index = this.pendingIndex;
    if (index < 0) {
      return;
    }
    this.handlers.onScrub(index);
    this.updateLabel(index);
  };

  private updateLabel(index: number) {
    this.handlers.setLabel?.(this.handlers.getLabel?.(index));
  }
}
