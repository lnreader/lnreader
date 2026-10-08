import { turn } from './position';
import type { ReaderState } from './state';

export const stopAutoScroll = (state: ReaderState) => {
  state.stopAutoScroll?.();
  state.stopAutoScroll = undefined;
};

export const setAutoScroll = (
  state: ReaderState,
  interval: number,
  distance?: number,
  smooth = false,
) => {
  stopAutoScroll(state);
  const paginator = state.paginator;
  if (!paginator || interval <= 0) {
    return;
  }
  const reachedEnd = () => {
    stopAutoScroll(state);
    state.bridge.send({ type: 'boundary', direction: 'next' });
  };
  // Pages, or stepped scrolling as the old reader did: a jump each interval.
  if (!paginator.scrolled || !smooth) {
    const timer = setInterval(() => {
      if (paginator.atEnd) {
        reachedEnd();
      } else if (paginator.scrolled) {
        void turn(state, 'next', distance || paginator.size);
      } else {
        state.sentTo = undefined;
        void paginator.next();
      }
    }, interval * 1000);
    state.stopAutoScroll = () => clearInterval(timer);
    return;
  }
  const speed = (distance || paginator.size) / interval;
  // Whole pixels scroll the container; the remainder shifts the content
  // (sub-pixel offset), so slow speeds still move smoothly.
  let frame = 0;
  let last = performance.now();
  let carry = 0;
  const step = (now: number) => {
    carry += (speed * (now - last)) / 1000;
    last = now;
    const whole = Math.floor(carry);
    if (whole > 0) {
      const before = paginator.containerPosition;
      state.sentTo = undefined;
      paginator.containerPosition = before + whole;
      carry -= whole;
      if (paginator.containerPosition === before && paginator.atEnd) {
        reachedEnd();
        return;
      }
    }
    paginator.subpixelOffset = carry;
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  state.stopAutoScroll = () => {
    cancelAnimationFrame(frame);
    paginator.subpixelOffset = 0;
  };
};
